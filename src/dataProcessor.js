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

  const total = valid.length;
  let min = valid[0].price, max = valid[0].price, sum = 0;
  for (const { price } of valid) {
    if (price < min) min = price;
    if (price > max) max = price;
    sum += price;
  }
  /** avg 使用四舍五入（Math.round），若需向下取整请改用 Math.floor */
  const avg = Math.round(sum / total);

  return {
    labels: buckets.map(b => b.label),
    counts: buckets.map(b => b.count),
    stats: { min, max, avg, total },
  };
}

module.exports = { processProducts };
