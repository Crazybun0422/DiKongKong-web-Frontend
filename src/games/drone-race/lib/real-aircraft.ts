import records from './real-aircraft-data.json';

export type BrandId='dji'|'potensic'|'autel'|'original';
export type RealAircraft={id:string;name:string;brand:Exclude<BrandId,'original'>;family:string;visualProfile:string;series:string;sourceUrl:string;bodyColor:string;massKg?:number;maxSpeedKph?:number;widthM?:number;cameraCount?:number;rotorCount?:number;coaxial?:boolean;specNote?:string};
export const BRANDS:{id:BrandId;name:string}[]=[{id:'dji',name:'大疆 DJI'},{id:'potensic',name:'博坦 Potensic'},{id:'autel',name:'道通 Autel'},{id:'original',name:'原创'}];
export const REAL_AIRCRAFT=records as RealAircraft[];
export const brandName=(id:BrandId)=>BRANDS.find(b=>b.id===id)?.name??id;
export const DEFAULT_AIRFRAME='dji-mini-4-pro';
