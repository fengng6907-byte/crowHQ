// Public virtual merchandise. These pixel interpretations are not live store inventory.
export const MALL_FLOORS = Object.freeze([
 {id:'c',label:'C',name:'Concourse',theme:'Everyday favourites',color:'#8cae96'},
 {id:'g',label:'G',name:'Ground',theme:'The grand arrival',color:'#bd9d62'},
 {id:'1',label:'1',name:'Level 1',theme:'Style around the atrium',color:'#ad90a1'},
 {id:'2',label:'2',name:'Level 2',theme:'Fashion & discoveries',color:'#7faaa7'},
 {id:'3',label:'3',name:'Level 3',theme:'Sport, sneakers & stories',color:'#8e9fbd'},
 {id:'4',label:'4',name:'Level 4',theme:'Dining & little adventures',color:'#bb9479'},
]);
export const floorForSpot = spot => MALL_FLOORS.find(f=>'mall-'+f.id===spot);
export const VIRTUAL_ITEMS = Object.freeze([
 {id:'nike-tee',brand:'Nike',name:'Dri-FIT running tee · pixel',slot:'top',color:'#e4ede2',accent:'#333d3d',pattern:'swoosh',source:'https://www.nike.com/my/w/mens-tops-t-shirts-9om13znik1'},
 {id:'nike-red',brand:'Nike',name:'Sport tee · ember',slot:'top',color:'#d96d4e',accent:'#f8edce',pattern:'swoosh',source:'https://www.nike.com/my/w/mens-tops-t-shirts-9om13znik1'},
 {id:'nike-shoes',brand:'Nike',name:'Air Force 1 ’07 · pixel',slot:'shoes',color:'#eef0df',accent:'#394745',source:'https://www.nike.com/my/t/air-force-1-07-shoe-HWWX9W/CT2302-100'},
 {id:'nike-cap',brand:'Nike',name:'Court cap',slot:'hat',color:'#6b8799',accent:'#e9ebd4',source:'https://www.nike.com/my/'},
 {id:'adidas-tee',brand:'Adidas',name:'Three-stripe tee',slot:'top',color:'#587f78',accent:'#f6ebce',pattern:'stripes',source:'https://www.adidas.com.my/en/men-t_shirts'},
 {id:'adidas-blue',brand:'Adidas',name:'Track top · midnight',slot:'top',color:'#536c9b',accent:'#eee9cb',pattern:'stripes',source:'https://www.adidas.com.my/en/men-t_shirts'},
 {id:'adidas-pants',brand:'Adidas',name:'Track trousers',slot:'bottom',color:'#3d5263',accent:'#e2e7cd',pattern:'stripes',source:'https://www.adidas.com.my/en/'},
 {id:'adidas-shoes',brand:'Adidas',name:'Samba OG · pixel',slot:'shoes',color:'#3e4c45',accent:'#d8ba81',source:'https://www.adidas.com.my/en/samba'},
]);
export const itemById = id => VIRTUAL_ITEMS.find(i=>i.id===id);
export function cleanWardrobe(value) {
 const owned=Array.isArray(value?.owned)?[...new Set(value.owned.filter(id=>!!itemById(id)))].slice(0,32):[];
 const equipped={};for(const slot of ['top','bottom','shoes','hat']){const item=itemById(value?.equipped?.[slot]);if(item?.slot===slot&&owned.includes(item.id))equipped[slot]=item.id;}
 return {owned,equipped};
}
export function dressAppearance(look,wardrobe) {
 const w=cleanWardrobe(wardrobe),top=itemById(w.equipped.top),bottom=itemById(w.equipped.bottom),shoes=itemById(w.equipped.shoes),hat=itemById(w.equipped.hat);
 return {...look,...(top?{shirt:top.color,topPattern:top.pattern,topAccent:top.accent}:{}),...(bottom?{pants:bottom.color,pantsStripe:bottom.pattern==='stripes'?bottom.accent:null}:{}),...(shoes?{shoes:shoes.color,shoeAccent:shoes.accent}:{}),...(hat?{hat:hat.color,hatAccent:hat.accent}:{})};
}
