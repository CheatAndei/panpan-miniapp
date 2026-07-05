const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'teach.db');
const DB_PATH = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
let _db = null;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function saveDB() {
  if (!_db) return;
  ensureDir(DB_PATH);
  fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
}

function execSQL(sql, params = []) {
  const stmt = _db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function execOne(sql, params = []) {
  const rows = execSQL(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execRun(sql, params = []) {
  _db.run(sql, params);
  const r = execOne('SELECT last_insert_rowid() as id');
  const changes = _db.getRowsModified();
  saveDB();
  return { lastInsertRowid: r?.id || 0, changes };
}

function ensureColumn(table, column, definition) {
  const columns = execSQL(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    _db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations() {
  ensureColumn('feedbacks', 'student_feedbacks', 'TEXT');
  ensureColumn('feedbacks', 'notes_pdf_url', 'TEXT');
  ensureColumn('checkins', 'check_out_note', 'TEXT');
}

async function initDB() {
  const SQL = await initSqlJs();
  ensureDir(DB_PATH);
  _db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  _db.run(schema);
  runMigrations();
  saveDB();
  setInterval(saveDB, 30000);
  console.log(`DB ready: ${DB_PATH}`);
}

function getDB() {
  return { all: execSQL, get: execOne, run: execRun, exec: (s) => { _db.run(s); saveDB(); } };
}

module.exports = { initDB, getDB, DB_PATH };
