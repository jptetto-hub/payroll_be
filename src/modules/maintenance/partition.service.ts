import { prisma } from "../../config/prisma";

type PartitionTarget = "Attendance" | "LedgerEntry" | "AuditLog";

const PARTITION_CONFIG: Record<
  PartitionTarget,
  {
    partitionColumn: string;
    indexes: (partitionName: string) => string[];
  }
> = {
  Attendance: {
    partitionColumn: "date",
    indexes: (partitionName) => [
      `CREATE INDEX IF NOT EXISTS "${partitionName}_employee_date_idx" ON "${partitionName}" ("employeeId", date);`,
      `CREATE INDEX IF NOT EXISTS "${partitionName}_date_status_idx" ON "${partitionName}" (date, status);`,
    ],
  },
  LedgerEntry: {
    partitionColumn: "date",
    indexes: (partitionName) => [
      `CREATE INDEX IF NOT EXISTS "${partitionName}_employee_date_idx" ON "${partitionName}" ("employeeId", date);`,
      `CREATE INDEX IF NOT EXISTS "${partitionName}_type_date_idx" ON "${partitionName}" (type, date);`,
    ],
  },
  AuditLog: {
    partitionColumn: "createdAt",
    indexes: (partitionName) => [
      `CREATE INDEX IF NOT EXISTS "${partitionName}_module_created_idx" ON "${partitionName}" (module, "createdAt");`,
      `CREATE INDEX IF NOT EXISTS "${partitionName}_user_created_idx" ON "${partitionName}" ("userId", "createdAt");`,
    ],
  },
};

function monthBounds(date: Date) {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const month = String(monthIndex + 1).padStart(2, "0");
  const start = `${year}-${month}-01`;
  const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0");
  const end = `${nextYear}-${nextMonth}-01`;

  return {
    year,
    month,
    start,
    end,
  };
}

function assertSafeIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
}

export class PartitionService {
  static async isPartitionedTable(tableName: PartitionTarget) {
    const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_partitioned_table pt
          JOIN pg_class c ON c.oid = pt.partrelid
          WHERE c.relname = $1
        ) AS "exists";
      `,
      tableName,
    );

    return Boolean(rows[0]?.exists);
  }

  static async createMonthlyPartition(
    tableName: PartitionTarget,
    date: Date,
  ) {
    const config = PARTITION_CONFIG[tableName];
    const { year, month, start, end } = monthBounds(date);
    const partitionName = `${tableName}_${year}_${month}`;

    assertSafeIdentifier(tableName);
    assertSafeIdentifier(partitionName);

    const isPartitioned = await this.isPartitionedTable(tableName);

    if (!isPartitioned) {
      return {
        tableName,
        partitionName,
        start,
        end,
        created: false,
        reason:
          "Base table is not partitioned yet. Create partitioned parent table in a dedicated migration first.",
      };
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${partitionName}"
      PARTITION OF "${tableName}"
      FOR VALUES FROM ('${start}') TO ('${end}');
    `);

    for (const sql of config.indexes(partitionName)) {
      await prisma.$executeRawUnsafe(sql);
    }

    return {
      tableName,
      partitionName,
      start,
      end,
      partitionColumn: config.partitionColumn,
      created: true,
    };
  }

  static async createNextMonthPartitions() {
    const now = new Date();
    const nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const results = [];

    for (const tableName of Object.keys(PARTITION_CONFIG) as PartitionTarget[]) {
      results.push(await this.createMonthlyPartition(tableName, nextMonth));
    }

    return results;
  }
}
