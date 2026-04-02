# 淘宝 iPhone 15 价格爬虫 — 设计文档

## 概述

一个 Node.js 脚本，爬取淘宝「iPhone 15」搜索结果的商品价格，通过 Express 服务提供数据接口，前端使用 Chart.js 渲染价格区间柱状图并展示统计指标。

---

## 架构

### 模块划分

| 文件 | 职责 |
|------|------|
| `src/scraper.js` | 启动有头 Puppeteer 浏览器，等待用户手动登录淘宝，搜索关键词，翻页抓取商品名称和价格，输出 `data/products.json` |
| `src/dataProcessor.js` | 解析价格字符串为数值，按可配置区间分组，返回 Chart.js 所需的 labels + data 结构 |
| `src/server.js` | Express 服务，`GET /api/data` 返回处理后的分组数据，静态服务 `public/` 目录，默认端口 3000 |
| `public/index.html` | 前端页面，fetch `/api/data`，用 Chart.js 渲染柱状图，展示统计卡片 |

### 数据流

```
node src/scraper.js
  → 用户手动登录淘宝
  → 抓取商品列表（名称 + 价格）
  → data/products.json

node src/server.js
  → GET /api/data → dataProcessor 分组
  → http://localhost:3000 → Chart.js 柱状图
```

### 目录结构

```
project/
├── src/
│   ├── scraper.js
│   ├── dataProcessor.js
│   └── server.js
├── public/
│   └── index.html
├── data/
│   └── products.json     # 自动生成，不提交 git
└── package.json
```

---

## 功能细节

### 爬虫（scraper.js）

- 使用 `puppeteer` 启动有头浏览器，打开淘宝首页
- 控制台提示用户手动登录，等待登录完成（检测 URL 或页面元素变化）
- 搜索「iPhone 15」，抓取当前页所有商品的名称和价格
- 支持翻页（可配置抓取页数，默认 3 页）
- 将结果保存为 `data/products.json`，格式：`[{ name, price }]`

### 数据处理（dataProcessor.js）

- 过滤非数字价格（清洗脏数据）
- 默认价格区间：0–1000、1000–2000、2000–3000、3000–4000、4000–5000、5000–6000、6000+
- 区间步长可通过参数配置
- 返回结构：`{ labels, counts, stats: { min, max, avg, total } }`

### API（server.js）

- `GET /api/data` — 读取 `data/products.json`，调用 `dataProcessor`，返回 JSON
- 若 `products.json` 不存在，返回 `404` 并提示先运行爬虫

### 前端（public/index.html）

- 页面标题：「iPhone 15 淘宝价格区间分布」
- 顶部统计卡片：最低价、最高价、均价、商品总数
- Chart.js 柱状图：X 轴为价格区间，Y 轴为商品数量，hover 显示具体数量

---

## 使用流程

```bash
# 1. 安装依赖
npm install

# 2. 抓取数据（会打开浏览器，需手动登录淘宝）
node src/scraper.js

# 3. 启动服务
node src/server.js

# 4. 打开浏览器查看图表
open http://localhost:3000
```

---

## 依赖

```json
{
  "puppeteer": "^21.x",
  "express": "^4.x",
  "chart.js": "^4.x（CDN 引入，无需 npm）"
}
```

---

## 注意事项

- 淘宝有反爬机制，建议控制翻页速度（每页间隔 1–2 秒）
- `data/products.json` 加入 `.gitignore`，避免提交个人数据
- 本脚本仅用于学习目的，请遵守淘宝用户协议
