const DB_NAME = 'casa-hq-prototype-v1';
let connection;
async function database() {
  if (connection) return connection;
  connection = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('state');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked'));
  });
  return connection;
}
export async function load() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('current');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}
export async function save(state) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(state, 'current');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Save aborted'));
  });
}
export function seed() {
  // EXAMPLES ONLY. No live address, assets, issues or financial information is exported.
  return {version:1, locale:'en', currentProperty:'demo-cp',
    properties:[{id:'demo-cp', name:'Casa Panchita', code:'CP', city:'Puerto Vallarta', state:'Jalisco', country:'México',
      neighborhood:'', street:'', postalCode:'', currency:'MXN', timeZone:'America/Mexico_City', color:'#254B40'}],
    areas:[['roof','Roof','Azotea'],['kitchen','Kitchen','Cocina'],['pool','Pool','Alberca'],['bedroom','Primary bedroom','Recámara principal'],['exterior','Exterior','Exterior']].map(([id,en,es]) => ({id,propertyId:'demo-cp',name:{en,es}})),
    assets:[['water','Water system','Sistema de agua'],['climate','Air conditioning','Aire acondicionado'],['solar','Solar','Sistema solar']].map(([id,en,es]) => ({id,propertyId:'demo-cp',name:{en,es}})),
    tickets:[], projects:[], contractors:[], history:[],
    maintenance:[{id:'demo-maintenance',propertyId:'demo-cp',title:{en:'Example: inspect roof drainage',es:'Ejemplo: revisar el drenaje de la azotea'},due:null}]
  };
}
