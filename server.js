require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const multer = require('multer');
const { put, del } = require('@vercel/blob');
const { Pool } = require('pg');

const app = express();

// ─── DATABASE ───
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is not defined in environment variables!');
} else {
  console.log('✅ DATABASE_URL is defined.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auto-create table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    category    VARCHAR(100) DEFAULT 'General',
    description TEXT,
    image_url   TEXT,
    featured    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('DB init error:', err.message));

// ─── MIDDLEWARE ───
app.set('trust proxy', 1); // Trust Vercel edge proxy for secure cookies
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
  name: 'sanyu_session',
  keys: [process.env.SESSION_SECRET || 'sanyu-fallback-secret-key'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true
}));

// Make session & config available in all EJS templates
app.use((req, res, next) => {
  res.locals.isAdmin = !!(req.session && req.session.isAdmin);
  res.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || '917947431586';
  next();
});

// Multer memory storage for Vercel Blob uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ─── HELPER: Upload to Vercel Blob ───
async function uploadToBlob(file) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN.includes('your_token_here')) {
    throw new Error('Vercel Blob Token is missing or invalid in .env');
  }
  try {
    const blob = await put(file.originalname, file.buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return blob.url;
  } catch (err) {
    console.error('Blob upload error:', err.message);
    throw err;
  }
}

// ─── AUTH MIDDLEWARE ───
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/login');
}

// ═══════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════

// Home page
app.get('/', async (req, res) => {
  try {
    const featured = await pool.query(
      'SELECT * FROM products WHERE featured = true ORDER BY created_at DESC LIMIT 8'
    );
    const countResult = await pool.query('SELECT COUNT(*) FROM products');
    const catResult = await pool.query('SELECT COUNT(DISTINCT category) FROM products');
    
    // If no featured products, show latest
    let products = featured.rows;
    if (products.length === 0) {
      const latest = await pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT 8');
      products = latest.rows;
    }
    
    res.render('index', {
      title: 'Sanyu Enterprises — Premium Quality Products',
      products,
      totalProducts: parseInt(countResult.rows[0].count),
      totalCategories: parseInt(catResult.rows[0].count)
    });
  } catch (err) {
    console.error('Home page error:', err.message);
    res.render('index', { title: 'Sanyu Enterprises', products: [], totalProducts: 0, totalCategories: 0 });
  }
});

// Catalog page
app.get('/catalog', async (req, res) => {
  try {
    const { search, category, sort } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      query += ` AND (LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex} OR LOWER(category) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }
    
    if (category && category !== 'all') {
      query += ` AND LOWER(category) = $${paramIndex}`;
      params.push(category.toLowerCase());
      paramIndex++;
    }
    
    if (sort === 'price-asc') query += ' ORDER BY price ASC';
    else if (sort === 'price-desc') query += ' ORDER BY price DESC';
    else if (sort === 'name') query += ' ORDER BY name ASC';
    else query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    const catResult = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
    
    res.render('catalog', {
      title: 'Shop All Products — Sanyu Enterprises',
      products: result.rows,
      categories: catResult.rows.map(r => r.category),
      currentSearch: search || '',
      currentCategory: category || 'all',
      currentSort: sort || 'newest'
    });
  } catch (err) {
    console.error('Catalog error:', err.message);
    res.render('catalog', {
      title: 'Shop All Products — Sanyu Enterprises',
      products: [], categories: [],
      currentSearch: '', currentCategory: 'all', currentSort: 'newest'
    });
  }
});

// Product detail page
app.get('/product/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).render('404', { title: 'Product Not Found' });
    
    const product = result.rows[0];
    const related = await pool.query(
      'SELECT * FROM products WHERE category = $1 AND id != $2 ORDER BY created_at DESC LIMIT 4',
      [product.category, product.id]
    );
    
    res.render('product', {
      title: `${product.name} — Sanyu Enterprises`,
      product,
      relatedProducts: related.rows
    });
  } catch (err) {
    console.error('Product detail error:', err.message);
    res.status(500).render('404', { title: 'Error' });
  }
});

// Cart page
app.get('/cart', (req, res) => {
  res.render('cart', {
    title: 'Shopping Cart — Sanyu Enterprises'
  });
});

// API: Get products (for cart rendering)
app.get('/api/products', async (req, res) => {
  try {
    const { ids } = req.query;
    if (ids) {
      const idArray = ids.split(',').map(Number).filter(n => !isNaN(n));
      if (idArray.length === 0) return res.json([]);
      const placeholders = idArray.map((_, i) => `$${i + 1}`).join(',');
      const result = await pool.query(`SELECT * FROM products WHERE id IN (${placeholders})`, idArray);
      return res.json(result.rows);
    }
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════

app.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('login', { title: 'Admin Login — Sanyu Enterprises', error: null });
});

app.post('/login', (req, res) => {
  const { pin } = req.body;
  if (pin === (process.env.ADMIN_PIN || 'sanyu2024')) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { title: 'Admin Login — Sanyu Enterprises', error: 'Incorrect PIN. Please try again.' });
});

app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

// ═══════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const products = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    const countResult = await pool.query('SELECT COUNT(*) FROM products');
    const catResult = await pool.query('SELECT COUNT(DISTINCT category) FROM products');
    const recentResult = await pool.query(
      "SELECT COUNT(*) FROM products WHERE created_at > NOW() - INTERVAL '7 days'"
    );
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard — Sanyu Enterprises',
      products: products.rows,
      stats: {
        total: parseInt(countResult.rows[0].count),
        categories: parseInt(catResult.rows[0].count),
        recentWeek: parseInt(recentResult.rows[0].count)
      }
    });
  } catch (err) {
    console.error('Admin page error:', err.message);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard — Sanyu Enterprises',
      products: [],
      stats: { total: 0, categories: 0, recentWeek: 0 }
    });
  }
});

// Create product
app.post('/admin/products', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description, image_url, featured } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    let finalImageUrl = image_url || null;
    
    // If file uploaded, push to Vercel Blob
    if (req.file) {
      const blobUrl = await uploadToBlob(req.file);
      if (blobUrl) finalImageUrl = blobUrl;
    }
    
    const result = await pool.query(
      `INSERT INTO products (name, price, category, description, image_url, featured)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, parseFloat(price), category || 'General', description || '', finalImageUrl, featured === 'on' || featured === true]
    );
    
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Create product error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update product
app.post('/admin/products/:id/update', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description, image_url, featured } = req.body;
    const { id } = req.params;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    let finalImageUrl = image_url || null;
    
    if (req.file) {
      const blobUrl = await uploadToBlob(req.file);
      if (blobUrl) finalImageUrl = blobUrl;
    }
    
    // If no new image provided, keep existing
    let query, params;
    if (finalImageUrl) {
      query = `UPDATE products SET name=$1, price=$2, category=$3, description=$4, image_url=$5, featured=$6, updated_at=NOW() WHERE id=$7 RETURNING *`;
      params = [name, parseFloat(price), category || 'General', description || '', finalImageUrl, featured === 'on' || featured === true, id];
    } else {
      query = `UPDATE products SET name=$1, price=$2, category=$3, description=$4, featured=$5, updated_at=NOW() WHERE id=$6 RETURNING *`;
      params = [name, parseFloat(price), category || 'General', description || '', featured === 'on' || featured === true, id];
    }
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Update product error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete product
app.post('/admin/products/:id/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get image URL to delete from Blob
    const product = await pool.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (product.rows.length > 0 && product.rows[0].image_url) {
      try {
        await del(product.rows[0].image_url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (e) {
        console.error('Blob delete error (non-fatal):', e.message);
      }
    }
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete product error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 404 ───
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found — Sanyu Enterprises' });
});

// ─── START ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✦ Sanyu Enterprises running on http://localhost:${PORT}`);
});

module.exports = app;
