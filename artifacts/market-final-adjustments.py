from pathlib import Path
B=Path('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market')
p=B/'api.js';s=p.read_text('utf-8').replace('function saveAddress(data){try{const key=addressKey();if(key)', 'function saveAddress(data,owner){try{const key=addressKey();if(key&&key===owner)').replace('module.exports={loadAddress,','module.exports={addressKey,loadAddress,');p.write_text(s,encoding='utf-8')
p=B/'detail/index.js';s=p.read_text('utf-8').replace('onLoad(o){this.id=o.id;this.setData(api.loadAddress());this.load();},','onLoad(o){this.id=o.id;this._addressOwner=api.addressKey();this.setData(api.loadAddress());this.load();},\n onShow(){const owner=api.addressKey();if(owner!==this._addressOwner){this._addressOwner=owner;this.setData({recipient:\'\',phone:\'\',address:\'\',...api.loadAddress()});this._shippingPoint=null;this.requestKey=null;this.orderId=null;}},').replace('api.saveAddress(this.data);','api.saveAddress(this.data,this._addressOwner);');p.write_text(s,encoding='utf-8')
p=B/'detail/index.wxml';s=p.read_text('utf-8').replace('{{product.originalText}}','{{selected.originalText}}').replace('{{product.cashText}}','{{selected.cashText}}').replace('{{product.flpText}}','{{selected.flpText}}').replace("{{product.stock ? '选择套餐并购买' : '暂时售罄'}}","{{product.stock ? (product.variants.length ? '选择套餐并购买' : '立即购买') : '暂时售罄'}}");p.write_text(s,encoding='utf-8')
p=Path('E:/source_code/wechat/DiKongKong-Backend/src/main/resources/db/migration/V18__market_gallery_variants.sql');p.write_text('''ALTER TABLE planet_market_product
    ADD COLUMN image_urls_json TEXT NULL,
    ADD COLUMN variants_json TEXT NULL;
ALTER TABLE planet_market_order
    ADD COLUMN variant_id VARCHAR(40) NULL,
    ADD COLUMN variant_name VARCHAR(80) NULL;
CREATE INDEX idx_market_product_pending ON planet_market_order (product_id, status);
''',encoding='utf-8')
