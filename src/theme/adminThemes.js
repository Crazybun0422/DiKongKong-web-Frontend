// Palette tokens shared by Vue components, page CSS and teleported Ant Design overlays.
const palette = (id, name, description, colors) => {
  const keys = ['bg', 'surface', 'raised', 'sidebar', 'text', 'muted', 'lime', 'accent-hover', 'accent-active', 'line', 'border', 'accent-soft', 'on-accent', 'summary', 'summary-text', 'summary-muted', 'summary-border'];
  return { id, name, description, colors: Object.fromEntries(keys.map((key, i) => [key, colors[i]])) };
};

export const adminThemes = [
  palette('lime-night', '青柠夜航', '炭黑与青柠，延续星球的经典绿色。', ['#111413','#1a211c','#232d24','#171d18','#f3f4ee','#a6ada3','#d6ff62','#e2ff96','#bedf55','#303a31','#3c473c','#2b3824','#18200d','#e2edcd','#1b2515','#58664d','#b7c6a3']),
  palette('ocean-blue', '深海蓝', '深蓝夜色，搭配清透的冰蓝。', ['#10151e','#182231','#223047','#141d2b','#f0f5fc','#a7b6ca','#85c8ff','#b1dcff','#62ade8','#303f55','#445771','#213c54','#0c2438','#dbeaf7','#182c3e','#4e6579','#aec7dc']),
  palette('twilight-purple', '暮光紫', '柔和紫光，让工作空间安静下来。', ['#16121c','#231d2d','#30273e','#1d1726','#f6f1fc','#b9aac9','#ceb0ff','#e2cfff','#b68ce9','#42344f','#574466','#3c2c50','#28133f','#eae0f7','#30213e','#6a557c','#cabbda']),
  palette('sand-gold', '暖砂金', '暖灰底色，点缀柔和砂金。', ['#191612','#27221a','#352e23','#211d17','#faf4e9','#bfb3a0','#efc67f','#ffdfa6','#d8ab63','#463d2e','#60513d','#433620','#32240e','#f2e6d1','#352a19','#73634c','#cebea2']),
  palette('ink-white', '墨白', '纯粹黑白与中性灰，简洁清晰。', ['#111111','#1d1d1d','#292929','#181818','#f5f5f5','#adadad','#ffffff','#ededed','#d5d5d5','#383838','#505050','#333333','#111111','#ededed','#202020','#606060','#bdbdbd']),
];

export const DEFAULT_ADMIN_THEME = 'lime-night';
export const findAdminTheme = (id) => adminThemes.find(item => item.id === id);
