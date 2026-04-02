/**
 * Express 服务
 * 提供 GET /api/data 接口和静态前端文件
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { processProducts } = require('./dataProcessor');

const app = express();
const PORT = process.env.PORT || 3000;
/** 抓取数据文件路径 */
const DATA_PATH = path.join(__dirname, '../data/products.json');
/** 前端静态文件目录 */
const PUBLIC_DIR = path.join(__dirname, '../public');

app.use(express.static(PUBLIC_DIR));

/**
 * 返回按价格区间分组后的商品数据
 * 若数据文件不存在，返回 404 提示先运行爬虫
 * @returns {void}
 */
app.get('/api/data', (req, res) => {
  let products;
  try {
    products = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ message: '数据文件不存在，请先运行 npm run scrape' });
    }
    return res.status(500).json({ message: '数据文件解析失败：' + e.message });
  }

  const result = processProducts(products);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`服务已启动：http://localhost:${PORT}`);
});
