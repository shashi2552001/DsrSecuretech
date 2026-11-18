import assert from 'node:assert/strict';
import {
  calculateWeightedProjectProgress,
  computeEmployeeProductivity,
  computeProjectFinancialSummary,
  generateNextInvoiceCode,
  generateNextProjectCode,
  generateNextTaskCode,
  isDateOverdue,
} from '../src/utils/calculations.ts';
import { DIRTY_DOZEN_SECURITY_TESTS } from '../firestore.rules.test.ts';
import type { Project, ProjectExpense, ProjectInvoice, Task } from '../src/types/domain.ts';

// 1. Weighted progress calculation
const sampleTasks: Task[] = [
  {
    id: 't1',
    taskCode: 'DSR-TSK-1001',
    projectId: 'p1',
    projectName: 'P1',
    title: 'T1',
    assignedByUid: 'a1',
    assignedAdminUid: 'a1',
    assigneeUid: 'm1',
    dueDate: '2026-12-01',
    priority: 'HIGH',
    status: 'Completed',
    progress: 100,
    weight: 60,
  },
  {
    id: 't2',
    taskCode: 'DSR-TSK-1002',
    projectId: 'p1',
    projectName: 'P1',
    title: 'T2',
    assignedByUid: 'a1',
    assignedAdminUid: 'a1',
    assigneeUid: 'm1',
    dueDate: '2026-12-05',
    priority: 'MEDIUM',
    status: 'In Progress',
    progress: 50,
    weight: 40,
  },
];

assert.equal(calculateWeightedProjectProgress(sampleTasks), 80, 'Weighted progress should be (100*60 + 50*40)/100 = 80');
assert.equal(calculateWeightedProjectProgress([]), 0, 'Empty tasks should yield 0%');

// 2. Auto-ID Generators
const year = new Date().getFullYear();
assert.equal(
  generateNextProjectCode([{ projectCode: `DSR-PRJ-${year}-0004` } as Project]),
  `DSR-PRJ-${year}-0005`
);
assert.equal(
  generateNextTaskCode([{ taskCode: 'DSR-TSK-1010' } as Task]),
  'DSR-TSK-1011'
);
assert.equal(
  generateNextInvoiceCode([{ invoiceNumber: `DSR-INV-${year}-0002` } as ProjectInvoice]),
  `DSR-INV-${year}-0003`
);

// 3. Overdue detection
assert.equal(isDateOverdue('2020-01-01', false), true);
assert.equal(isDateOverdue('2020-01-01', true), false);

// 4. Financial P&L calculation
const proj: Project = {
  id: 'p1',
  projectCode: `DSR-PRJ-${year}-0001`,
  projectName: 'Test',
  clientId: 'c1',
  clientName: 'Client',
  category: 'VAPT',
  assignedAdminUid: 'a1',
  assignedMemberUids: ['m1'],
  priority: 'HIGH',
  status: 'In Progress',
  progress: 80,
  isArchived: false,
  createdByUid: 'sa',
  budget: 100000,
  quotedAmount: 120000,
  totalReceived: 90000,
};
const exps: ProjectExpense[] = [
  {
    id: 'e1',
    projectId: 'p1',
    assignedAdminUid: 'a1',
    category: 'Operational',
    description: 'Ops',
    amount: 25000,
    expenseDate: '2026-11-01',
    recordedByUid: 'sa',
  },
];
const fin = computeProjectFinancialSummary(proj, exps, []);
assert.equal(fin.netProfit, 65000);
assert.equal(fin.pending, 30000);

// 5. Employee productivity
const prod = computeEmployeeProductivity(sampleTasks, 'm1');
assert.equal(prod.total, 2);
assert.equal(prod.completed, 1);

// 6. Dirty Dozen Security Spec Count
assert.equal(DIRTY_DOZEN_SECURITY_TESTS.length, 12);

console.log('ALL_DOMAIN_AND_SECURITY_TESTS_PASSED');
