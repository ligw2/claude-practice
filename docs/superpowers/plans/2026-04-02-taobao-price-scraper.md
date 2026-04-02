# 淘宝价格爬虫 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 爬取淘宝「iPhone 15」商品价格，通过 Express API 提供数据，前端用 Chart.js 渲染价格区间柱状图。

**Architecture:** Puppeteer 有头浏览器抓取淘宝数据写入 `data/products.json`；Express 服务读取该文件经 dataProcessor 分组后通过 `/api/data` 返回；前端 `index.html` 通过 CDN 引入 Chart.js 渲染柱状图和统计卡片。

**Tech Stack:** Node.js 18+, Puppeteer 21, Express 4, Chart.js 4 (CDN)

---

## 文件清单

| 文件 | 操作 |
|------|------|
| `package.json` | 创建 |
| `.gitignore` | 创建 |
| `src/dataProcessor.js` | 创建 |
| `src/scraper.js` | 创建 |
| `src/server.js` | 创建 |
| `public/index.html` | 创建 |

> **并行说明：** Task 1（项目初始化）须最先完成。Task 2（dataProcessor）、Task 3（scraper）、Task 4（前端）相互独立，可由三个子代理并行执行。Task 5（server）依赖 Task 2 完成后执行。Task 6（集成验证）最后执行。

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: 创建 package.json**

```bash
cd E:\learn\claude-practice
npm init -y
npm install puppeteer@^21 express@^4
```

将 `package.json` 的 `main` 字段改为 `src/server.js`，并添加 scripts：

```json
{
  "scripts": {
    "scrape": "node src/scraper.js",
    "start": "node src/server.js"
  }
}
```

- [ ] **Step 2: 创建 .gitignore**

```
node_modules/
data/products.json
.superpowers/
```

- [ ] **Step 3: 创建目录结构**

```bash
mkdir -p src public data
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore(init): 初始化项目依赖和目录结构"
```

---

## Task 2: dataProcessor 模块（可并行）

**Files:**
- Create: `src/dataProcessor.js`

- [ ] **Step 1: 编写 dataProcessor.js**

```js
/**
 * 将商品列表按价格区间分组，计算统计指标
 * @param {Array<{name: string, price: number}>} products - 商品列表
 * @param {number} [step=1000] - 价格区间步长（元）
 * @param {number} [maxBucket=6000] - 最后一个固定区间的起始值
 * @returns {{ labels: string[], counts: number[], stats: { min: number, max: number, avg: number, total: number } }}
 */
function processProducts(products, step = 1000, maxBucket = 6000) {
  /** 过滤掉无效价格 */
  const valid = products.filter(p => typeof p.price === 'number' && !isNaN(p.price) && p.price > 0);

  if (valid.length === 0) {
    return { labels: [], counts: [], stats: { min: 0, max: 0, avg: 0, total: 0 } };
  }

  /** 构建区间标签和计数桶 */
  const buckets = [];
  for (let start = 0; start < maxBucket; start += step) {
    buckets.push({ label: `${start}–${start + step}`, start, end: start + step, count: 0 });
  }
  buckets.push({ label: `${maxBucket}+`, start: maxBucket, end: Infinity, count: 0 });

  /** 将每个商品归入对应桶 */
  for (const { price } of valid) {
    const bucket = buckets.find(b => price >= b.start && price < b.end);
    if (bucket) bucket.count++;
  }

  const prices = valid.map(p => p.price);
  const total = prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / total);

  return {
    labels: buckets.map(b => b.label),
    counts: buckets.map(b => b.count),
    stats: { min, max, avg, total },
  };
}

module.exports = { processProducts };
```

- [ ] **Step 2: 验证模块可正常 require**

```bash
node -e "const { processProducts } = require('./src/dataProcessor'); console.log(processProducts([{name:'test',price:3500}]))"
```

期望输出包含：`counts` 数组中第 4 个元素为 `1`，`stats.total` 为 `1`。

- [ ] **Step 3: Commit**

```bash
git add src/dataProcessor.js
git commit -m "feat(dataProcessor): 实现价格区间分组和统计指标计算"
```

---

## Task 3: scraper 模块（可并行）

**Files:**
- Create: `src/scraper.js`

- [ ] **Step 1: 编写 scraper.js**

```js
/**
 * 淘宝商品价格爬虫
 * 启动有头 Puppeteer 浏览器，等待用户手动登录后，
 * 搜索 iPhone 15 并翻页抓取商品名称和价格
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/** 爬取页数 */
const PAGES = 3;
/** 每页翻页等待时间（ms），避免触发反爬 */
const PAGE_DELAY = 2000;
/** 输出文件路径 */
const OUTPUT_PATH = path.join(__dirname, '../data/products.json');

/**
 * 等待淘宝登录完成（检测登录态 Cookie）
 * @param {import('puppeteer').Page} page
 */
async function waitForLogin(page) {
  console.log('请在浏览器中手动登录淘宝，完成后脚本将自动继续...');
  await page.waitForFunction(
    () => document.cookie.includes('_m_h5_tk') || document.cookie.includes('WAPFDFD'),
    { timeout: 120000, polling: 1000 }
  );
  console.log('登录成功，开始抓取...');
}

/**
 * 从当前页面抓取商品列表
 * @param {import('puppeteer').Page} page
 * @returns {Promise<Array<{name: string, price: number}>>}
 */
async function scrapeCurrentPage(page) {
  return page.evaluate(() => {
    const items = [];
    // 淘宝搜索结果商品卡片选择器（2024年结构）
    document.querySelectorAll('[data-item-id]').forEach(el => {
      const nameEl = el.querySelector('.title--qJ7Xg3rd, [class*="title"]');
      const priceEl = el.querySelector('[class*="priceInt"], [class*="price"]');
      if (!nameEl || !priceEl) return;
      const name = nameEl.innerText.trim();
      const priceText = priceEl.innerText.replace(/[^0-9.]/g, '');
      const price = parseFloat(priceText);
      if (name && !isNaN(price)) items.push({ name, price });
    });
    return items;
  });
}

/**
 * 主流程：打开淘宝 → 等待登录 → 搜索 → 翻页抓取 → 保存
 */
async function main() {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  await page.goto('https://www.taobao.com', { waitUntil: 'domcontentloaded' });
  await waitForLogin(page);

  // 搜索 iPhone 15
  await page.goto('https://s.taobao.com/search?q=iPhone+15', { waitUntil: 'networkidle2' });

  const allProducts = [];

  for (let i = 1; i <= PAGES; i++) {
    console.log(`抓取第 ${i} 页...`);
    await page.waitForSelector('[data-item-id]', { timeout: 10000 }).catch(() => {});
    const products = await scrapeCurrentPage(page);
    allProducts.push(...products);
    console.log(`  第 ${i} 页获取 ${products.length} 件商品`);

    if (i < PAGES) {
      // 点击下一页
      const nextBtn = await page.$('[aria-label="下一页"]');
      if (!nextBtn) { console.log('无下一页，停止翻页'); break; }
      await nextBtn.click();
      await new Promise(r => setTimeout(r, PAGE_DELAY));
    }
  }

  await browser.close();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allProducts, null, 2), 'utf-8');
  console.log(`抓取完成，共 ${allProducts.length} 件商品，已保存至 ${OUTPUT_PATH}`);
}

main().catch(err => { console.error('爬虫出错:', err); process.exit(1); });
```

- [ ] **Step 2: 检查语法无报错**

```bash
node --check src/scraper.js
```

期望：无输出（语法正确）。

- [ ] **Step 3: Commit**

```bash
git add src/scraper.js
git commit -m "feat(scraper): 实现淘宝 iPhone15 价格爬虫（有头模式+手动登录）"
```

---

## Task 4: 前端页面（可并行）

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: 编写 public/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>iPhone 15 淘宝价格分布</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; padding: 32px 24px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; min-width: 120px; }
    .stat-label { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 600; }
    .chart-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; }
    #error { color: #ef4444; padding: 16px; background: #fef2f2; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>iPhone 15 淘宝价格区间分布</h1>
  <p class="subtitle" id="subtitle">加载中...</p>

  <div class="stats" id="stats"></div>

  <div class="chart-wrap">
    <canvas id="chart"></canvas>
  </div>

  <div id="error" style="display:none"></div>

  <script>
    async function init() {
      const res = await fetch('/api/data');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = '错误：' + (err.message || res.statusText);
        document.getElementById('subtitle').textContent = '数据加载失败';
        return;
      }

      const { labels, counts, stats } = await res.json();

      document.getElementById('subtitle').textContent =
        `共抓取 ${stats.total} 件商品 · 搜索关键词：iPhone 15`;

      const statsEl = document.getElementById('stats');
      [
        { label: '最低价', value: '¥ ' + stats.min.toLocaleString() },
        { label: '最高价', value: '¥ ' + stats.max.toLocaleString() },
        { label: '均价',   value: '¥ ' + stats.avg.toLocaleString() },
        { label: '商品总数', value: stats.total + ' 件' },
      ].forEach(({ label, value }) => {
        statsEl.innerHTML += `
          <div class="stat-card">
            <div class="stat-label">${label}</div>
            <div class="stat-value">${value}</div>
          </div>`;
      });

      new Chart(document.getElementById('chart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: '商品数量',
            data: counts,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` ${ctx.raw} 件商品` } },
          },
          scales: {
            x: { title: { display: true, text: '价格区间（元）' } },
            y: { title: { display: true, text: '商品数量' }, beginAtZero: true },
          },
        },
      });
    }

    init().catch(err => {
      document.getElementById('error').style.display = 'block';
      document.getElementById('error').textContent = '加载失败：' + err.message;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat(frontend): 实现 Chart.js 价格柱状图和统计卡片"
```

---

## Task 5: Express 服务（依赖 Task 2 完成）

**Files:**
- Create: `src/server.js`

- [ ] **Step 1: 编写 server.js**

```js
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
 */
app.get('/api/data', (req, res) => {
  if (!fs.existsSync(DATA_PATH)) {
    return res.status(404).json({ message: '数据文件不存在，请先运行 npm run scrape' });
  }

  let products;
  try {
    products = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch (e) {
    return res.status(500).json({ message: '数据文件解析失败：' + e.message });
  }

  const result = processProducts(products);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`服务已启动：http://localhost:${PORT}`);
});
```

- [ ] **Step 2: 检查语法**

```bash
node --check src/server.js
```

期望：无输出。

- [ ] **Step 3: Commit**

```bash
git add src/server.js
git commit -m "feat(server): 实现 Express API 和静态文件服务"
```

---

## Task 6: 集成验证（最后执行）

- [ ] **Step 1: 创建测试用 mock 数据**

```bash
cat > data/products.json << 'EOF'
[
  {"name":"iPhone 15 128G","price":4999},
  {"name":"iPhone 15 256G","price":5599},
  {"name":"iPhone 15 二手","price":3200},
  {"name":"iPhone 15 配件","price":99},
  {"name":"iPhone 15 Pro","price":7999},
  {"name":"iPhone 15 国行","price":5199},
  {"name":"iPhone 15 港版","price":4799},
  {"name":"iPhone 15 翻新","price":3800},
  {"name":"iPhone 15 Plus","price":6199},
  {"name":"iPhone 15 壳","price":29}
]
EOF
```

- [ ] **Step 2: 启动服务并验证 API**

```bash
node src/server.js &
sleep 1
curl http://localhost:3000/api/data
```

期望输出包含 `labels`、`counts`、`stats` 字段，`stats.total` 为 `10`。

- [ ] **Step 3: 验证前端页面可访问**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

期望输出：`200`

- [ ] **Step 4: 清理测试数据并提交**

```bash
rm data/products.json
git add -A
git commit -m "chore(verify): 集成验证通过，清理测试数据"
```
