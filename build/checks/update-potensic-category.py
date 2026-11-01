from pathlib import Path
mini=Path('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram')
android=Path('D:/Workspace/LowLatitudePlanet/app/src/main')
def edit(path,replacements):
 s=path.read_text(encoding='utf8')
 for old,new in replacements:
  assert old in s,(str(path),old)
  s=s.replace(old,new,1)
 path.write_text(s,encoding='utf8')
edit(mini/'pages/map/utils/drone-picker.js',[
 ('if (item.brand === "博坦") return "potensic";','if (item.brand === "博坦") return "consumer-portable";'),
 ('    { id: "potensic", label: "博坦", items: [] },\n',''),
 ('brand: item.brand || ""','brand: item.brand || "DJI"'),
 ('if (!Array.isArray(category.items) || category.id === "potensic") return;','if (!Array.isArray(category.items)) return;')])
edit(android/'java/cn/llplanet/lowlatitudeplanet/map/DashboardPanels.kt',[
 ('item.optString("brand")=="博坦" -> R.string.category_potensic','item.optString("brand")=="博坦" -> R.string.category_portable'),
 ('R.string.category_logistics,R.string.category_potensic,R.string.category_other','R.string.category_logistics,R.string.category_other'),
 ('.let { rows -> if(rows.firstOrNull()?.optString("brand")=="博坦") rows else rows.sortedBy { it.optString("name").lowercase() } }','.sortedBy { it.optString("name").lowercase() }'),
 ('if(item.optString("brand").isNotBlank()) Text(item.optString("brand"),fontSize=10.sp','Text(item.optString("brand").ifBlank { "DJI" },fontSize=10.sp')])
for variant,label in [('values','博坦'),('values-zh-rCN','博坦'),('values-en','Potensic')]:
 edit(android/('res/'+variant+'/strings.xml'),[('    <string name="category_potensic">'+label+'</string>\n','')])
print('Updated mini and Android categories and brand badges.')
