const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function parseArgs(argv) {
  const result = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply') result.apply = true;
    else if (value === '--manifest') result.manifest = argv[++index];
    else if (value === '--database') result.database = argv[++index];
    else if (value === '--expect-student-external-id') result.expectedExternalId = argv[++index];
    else if (value === '--help' || value === '-h') result.help = true;
    else throw new Error(`未知参数：${value}`);
  }
  return result;
}

function usage() {
  return [
    '专属每日练习清单检查/应用',
    '',
    '只读预检（默认）：',
    '  node scripts/apply-student-practice-curriculum.js --manifest <json>',
    '',
    '备份成功后应用：',
    '  node scripts/apply-student-practice-curriculum.js --manifest <json> --apply',
    '',
    '可选保护：',
    '  --database <db-path>',
    '  --expect-student-external-id <stu_xxx>',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.manifest) throw new Error('缺少 --manifest；默认只执行预检，不会写入');
  const manifestPath = path.resolve(args.manifest);
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    throw new Error(`清单不存在：${manifestPath}`);
  }
  const sourceDatabase = args.database
    ? path.resolve(args.database)
    : path.resolve(__dirname, '..', 'data', 'teach.db');
  let preflightDirectory = null;
  if (args.apply) {
    process.env.DATABASE_PATH = sourceDatabase;
  } else {
    if (!fs.existsSync(sourceDatabase) || !fs.statSync(sourceDatabase).isFile()) {
      throw new Error(`预检源数据库不存在：${sourceDatabase}`);
    }
    preflightDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'panpan-curriculum-preflight-'));
    const clonePath = path.join(preflightDirectory, 'teach.db');
    fs.copyFileSync(sourceDatabase, clonePath);
    process.env.DATABASE_PATH = clonePath;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (args.expectedExternalId) {
    const actual = String(manifest?.student_match?.external_id || '');
    if (actual !== String(args.expectedExternalId)) {
      throw new Error('清单 student_match.external_id 与 --expect-student-external-id 不一致');
    }
  }

  try {
    const { initDB, getDB, DB_PATH } = require('../db/init');
    const { applyStudentCurriculum } = require('../services/student-practice-curriculum');
    await initDB();
    const result = applyStudentCurriculum(getDB(), manifest, { dryRun: !args.apply });
    const printableResult = args.apply ? result : {
      ok: result.ok,
      dry_run: true,
      manifest_sha256: result.manifest_sha256,
      student: result.student ? {
        external_id: result.student.external_id,
        name: result.student.name,
        teacher_nickname: result.student.teacher_nickname,
        class_name: result.student.class_name,
      } : null,
      retirable_plans: result.retirable_plans,
      already_retired_plans: result.already_retired_plans,
      replaceable_assignments: result.replaceable_assignments,
      unchanged_assignments: result.unchanged_assignments,
      assignment_count: result.assignment_count,
    };
    console.log(JSON.stringify({
      source_database: sourceDatabase,
      working_database: DB_PATH,
      manifest: manifestPath,
      mode: args.apply ? 'apply' : 'dry-run',
      ...printableResult,
    }, null, 2));
    if (!args.apply) {
      console.log('预检通过；检查只写临时副本。生产应用前必须先备份，再追加 --apply。');
    }
  } finally {
    if (preflightDirectory) fs.rmSync(preflightDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    code: error.code || 'CURRICULUM_SCRIPT_FAILED',
    error: error.message,
  }, null, 2));
  process.exitCode = 1;
});
