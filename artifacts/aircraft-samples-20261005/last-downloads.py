import importlib.util
from pathlib import Path
p=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('finish',p/'finish-downloads.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.items={
'dji-mini-4k':('https://laudistribution.com/products/dji-mini-4k','https://laudistribution.com/cdn/shop/files/mini_4k.png?v=1730190623'),
'dji-mavic-4-pro':('https://www.heathcotes.co.nz/dji-mavic-4-pro-cp-ma-00000849','https://www.heathcotes.co.nz/content/products/cp-ma-00000849-dji-mavic-4-pro-8d14e19e93.jpg'),
'dji-avata-360':('https://www.parkcameras.com/shop/dji-avata-360-rc-2_9703510a','https://dtz3um9jw7ngl.cloudfront.net/p/l/9703510A/9703510A_2.jpg'),
'dji-matrice-3d-3td':('https://www.syd.com.tr/urun/dji-matrice-3d','https://www.syd.com.tr/shop/ae/82/myassets/products/074/dji-matrice-3d.png?revision=1744010505'),
'dji-matrice-4d-4td':('https://dji-retail.co.uk/products/dji-matrice-4d-drone-for-dock-3-drone-only','https://dji-retail.co.uk/cdn/shop/files/DJI-Matrice-4D-aircraft-for-DJI-Dock-3_1000x_100e06d7-94b1-43b8-9e50-8e985c7d097c.webp?v=1740756028'),
'mg-new-t60':('https://x-droners.com/uav/productInfo/26040034','https://x-droners.com/upload/img/260410/da-jiang-t60-nong-ye-wu-ren-fei-ji-2.jpg'),
'mg-new-t70-s':('https://x-droners.com/uav/productInfo/26040040','https://x-droners.com/upload/img/260412/da-jiang-t70s-nong-ye-zhi-bao-wu-ren-fei-ji.jpg'),
'mg-new-t100-s':('https://ag.dji.com/cn/newsroom','https://www-cdn.djiits.com/cms/uploads/4d5cc14f75cf9452dafef7da7b2e5bb7%40592%2A392.jpg')
}
m.main()
