/* eslint-disable no-console */

const { spawn } = require('child_process');

const requiredEnv = [
  'BASE_URL',
  'USER_PHONE',
  'USER_PASSWORD',
  'ADMIN_PHONE',
  'ADMIN_PASSWORD',
  'SUPER_ADMIN_PHONE',
  'SUPER_ADMIN_PASSWORD',
];

const recommendedEnv = [
  'WEEKLY_EMPLOYEE_ID',
  'MONTHLY_EMPLOYEE_ID',
  'WEEKLY_PAYROLL_ID',
];

const steps = [
  {
    name: 'Step 1 - API Smoke Test',
    command: 'npm',
    args: ['run', 'test:smoke'],
    required: true,
  },
  {
    name: 'Step 2 - Auth + RBAC Test',
    command: 'npm',
    args: ['run', 'test:auth-rbac'],
    required: true,
  },
  {
    name: 'Step 3 - Employee + Salary History Flow',
    command: 'npm',
    args: ['run', 'test:employee-salary'],
    required: false,
  },
  {
    name: 'Step 4 - Attendance + Salary Calculation Flow',
    command: 'npm',
    args: ['run', 'test:attendance-salary'],
    required: false,
  },
  {
    name: 'Step 5 - Advance + Payroll Flow',
    command: 'npm',
    args: ['run', 'test:advance-payroll'],
    required: false,
  },
  {
    name: 'Step 6 - Attendance Request Workflow',
    command: 'npm',
    args: ['run', 'test:attendance-request'],
    required: false,
  },
  {
    name: 'Step 7 - Payslip + Ledger + Reports + Audit Logs',
    command: 'npm',
    args: ['run', 'test:payslip-ledger-reports'],
    required: false,
  },
  {
    name: 'Step 8 - Settings + Overtime Flow',
    command: 'npm',
    args: ['run', 'test:settings-overtime'],
    required: false,
  },
  {
    name: 'Step 9 - Scheduler Safe Check',
    command: 'npm',
    args: ['run', 'test:scheduler'],
    required: false,
    extraEnv: { RUN_SCHEDULER: '' },
  },
  {
    name: 'Step 10 - Security + Negative Validation',
    command: 'npm',
    args: ['run', 'test:security-validation'],
    required: true,
  },
];

function printEnvStatus() {
  console.log('\n==============================');
  console.log('Backend Master Safe Test Runner');
  console.log('==============================\n');

  const missingRequired = requiredEnv.filter((key) => !process.env[key]);
  const missingRecommended = recommendedEnv.filter((key) => !process.env[key]);

  if (missingRequired.length) {
    console.log('❌ Missing required env values:');
    missingRequired.forEach((key) => console.log(`   - ${key}`));
    console.log('\nPlease provide these values and run again.');
    process.exit(1);
  }

  if (missingRecommended.length) {
    console.log('⚠️  Missing recommended env values. Some flow-specific checks may be skipped or may warn:');
    missingRecommended.forEach((key) => console.log(`   - ${key}`));
    console.log('');
  }

  if (process.env.RUN_SCHEDULER === 'true') {
    console.log('⚠️  RUN_SCHEDULER=true detected. The master runner will override it to keep this run safe.');
    console.log('   Run npm run test:scheduler separately with RUN_SCHEDULER=true if you intentionally want to trigger scheduler.\n');
  }
}

function runStep(step) {
  return new Promise((resolve) => {
    console.log('\n====================================================');
    console.log(`▶ ${step.name}`);
    console.log('====================================================\n');

    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...(step.extraEnv || {}),
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${step.name} completed\n`);
        resolve({ step: step.name, code, passed: true, required: step.required });
        return;
      }

      console.log(`\n❌ ${step.name} failed with exit code ${code}\n`);
      resolve({ step: step.name, code, passed: false, required: step.required });
    });
  });
}

async function main() {
  printEnvStatus();

  const results = [];

  for (const step of steps) {
    const result = await runStep(step);
    results.push(result);

    if (!result.passed && result.required) {
      console.log('Stopping because a required safety test failed. Fix this before continuing.');
      break;
    }
  }

  console.log('\n==============================');
  console.log('Final Test Summary');
  console.log('==============================');

  for (const result of results) {
    const icon = result.passed ? '✅' : result.required ? '❌' : '⚠️';
    const label = result.required ? 'required' : 'flow';
    console.log(`${icon} ${result.step} (${label})`);
  }

  const failedRequired = results.filter((result) => result.required && !result.passed);

  if (failedRequired.length) {
    console.log('\n❌ Required tests failed. Do not move to production until these are fixed.');
    process.exit(1);
  }

  console.log('\n✅ Master safe test run completed. Review warnings/failures from flow tests above before production.');
}

main().catch((error) => {
  console.error('Master test runner crashed:', error);
  process.exit(1);
});
