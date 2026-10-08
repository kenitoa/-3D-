import encodeQR from 'qr';
function checkedLink(value) {
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || value.length > 2500) throw new Error('공유 가능한 HTTP 링크를 입력해 주세요.');
  return url.href;
}
window.CampusQr = Object.freeze({
  async toDataURL(url) { return encodeQR(checkedLink(url),'data-url',{ecc:'medium',border:4,scale:4}); },
  encodeSVG(url) { return encodeQR(checkedLink(url),'svg',{ecc:'medium',border:4,scale:4}); }
});
