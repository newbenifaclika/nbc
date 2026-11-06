import fs from 'node:fs';
let DatabaseSync;
try { ({DatabaseSync}=await import('node:sqlite')); } catch {}
export const sqliteAvailable=!!DatabaseSync;
export function testEnvironment(existing=null){
 const sqlite=existing||new DatabaseSync(':memory:');
 if(!existing)sqlite.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){return{sql,values:[],bind(...values){this.values=values;return this},async first(){return sqlite.prepare(sql).get(...this.values)||null},async all(){return{results:sqlite.prepare(sql).all(...this.values)}},async run(){const result=sqlite.prepare(sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes)}}}}},async batch(statements){
  sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}
 }};
 return{DB,sqlite,ADMIN_PASSWORD:'test-password',SESSION_SECRET:'test-secret',MEDIA:{async head(){return null},async delete(){}},state:{artists:()=>sqlite.prepare('SELECT * FROM artists ORDER BY sort_order').all()}};
}
