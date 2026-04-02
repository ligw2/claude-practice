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
 * @returns {Promise<void>}
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
 * @returns {Promise<void>}
 */
async function main() {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  try {
    const page = await browser.newPage();

    await page.goto('https://www.taobao.com', { waitUntil: 'domcontentloaded' });
    await waitForLogin(page);

    // 搜索 iPhone 15
    await page.goto('https://s.taobao.com/search?q=iPhone+15', { waitUntil: 'networkidle2' });

    const allProducts = [];

    for (let i = 1; i <= PAGES; i++) {
      console.log(`抓取第 ${i} 页...`);
      await page.waitForSelector('[data-item-id]', { timeout: 10000 }).catch(err => {
        console.warn(`第 ${i} 页等待商品卡片超时：`, err.message);
      });
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

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allProducts, null, 2), 'utf-8');
    console.log(`抓取完成，共 ${allProducts.length} 件商品，已保存至 ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error('爬虫出错:', err); process.exit(1); });
