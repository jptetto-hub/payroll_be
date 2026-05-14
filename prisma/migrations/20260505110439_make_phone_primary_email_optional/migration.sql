/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - Made the column `phone` on table `Employee` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_phone_key" ON "Employee"("phone");
