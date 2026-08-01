import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  datetime,
  json,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core';

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  role: mysqlEnum('role', ['admin', 'editor', 'employer']).notNull(),
  companyId: int('company_id'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: datetime('last_login_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------

export const companies = mysqlTable('companies', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  logoUrl: varchar('logo_url', { length: 500 }),
  whatsapp: varchar('whatsapp', { length: 20 }),
  website: varchar('website', { length: 500 }),
  description: text('description'),
  ownerUserId: int('owner_user_id'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// categories / cities
// ---------------------------------------------------------------------------

export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
});

export const cities = mysqlTable('cities', {
  id: int('id').autoincrement().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------

export const contractTypeEnum = [
  'tiempo_completo',
  'medio_tiempo',
  'temporal',
  'pasantia',
  'freelance',
] as const;

export const seniorityEnum = [
  'sin_experiencia',
  'junior',
  'semi_senior',
  'senior',
] as const;

export const modalityEnum = ['presencial', 'remoto', 'hibrido'] as const;

export const jobStatusEnum = [
  'draft',
  'pending',
  'published',
  'rejected',
  'archived',
] as const;

export const jobs = mysqlTable(
  'jobs',
  {
    id: int('id').autoincrement().primaryKey(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    companyId: int('company_id').notNull(),
    categoryId: int('category_id').notNull(),
    cityId: int('city_id').notNull(),
    contractType: mysqlEnum('contract_type', contractTypeEnum).notNull(),
    seniority: mysqlEnum('seniority', seniorityEnum).notNull(),
    modality: mysqlEnum('modality', modalityEnum).notNull(),
    salaryMin: int('salary_min'),
    salaryMax: int('salary_max'),
    salaryHidden: boolean('salary_hidden').notNull().default(false),
    description: text('description').notNull(),
    whatsapp: varchar('whatsapp', { length: 20 }),
    status: mysqlEnum('status', jobStatusEnum).notNull().default('draft'),
    featuredUntil: datetime('featured_until'),
    publishedAt: datetime('published_at'),
    expiresAt: datetime('expires_at'),
    rejectionReason: text('rejection_reason'),
    createdBy: int('created_by'),
    updatedBy: int('updated_by'),
    createdAt: datetime('created_at').notNull(),
    updatedAt: datetime('updated_at').notNull(),
  },
  (table) => [
    index('status_published_at_idx').on(table.status, table.publishedAt),
    index('status_category_city_idx').on(table.status, table.categoryId, table.cityId),
    index('status_featured_until_idx').on(table.status, table.featuredUntil),
  ],
);

// ---------------------------------------------------------------------------
// applications (Phase E)
// ---------------------------------------------------------------------------

export const applicationStatusEnum = ['new', 'reviewed', 'contacted', 'discarded'] as const;

export const applications = mysqlTable(
  'applications',
  {
    id: int('id').autoincrement().primaryKey(),
    jobId: int('job_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 320 }),
    message: text('message'),
    sourcePage: varchar('source_page', { length: 255 }),
    status: mysqlEnum('status', applicationStatusEnum).notNull().default('new'),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('job_created_idx').on(table.jobId, table.createdAt)],
);

// ---------------------------------------------------------------------------
// activity_log
// ---------------------------------------------------------------------------

export const activityLog = mysqlTable('activity_log', {
  id: int('id').autoincrement().primaryKey(),
  actorUserId: int('actor_user_id'),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: int('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  meta: json('meta'),
  createdAt: datetime('created_at').notNull(),
});
