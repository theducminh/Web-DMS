/**
 * Seed dữ liệu khởi tạo: Admin Root + 4 demo user + phòng ban + Project Template SOFTWARE_DEV.
 * Chạy: npm run prisma:seed  (hoặc: make seed)
 *
 * Demo accounts (mặc định tất cả mật khẩu = Admin@123456):
 *   minhchoi2004@gmail.com        Admin Root      CONFIDENTIAL
 *   nguyenhuutuon2@gmail.com      Project Manager CONFIDENTIAL
 *   duccccccc123123@gmail.com     Developer       INTERNAL
 *   ducngominh2k4@gmail.com       Senior Reviewer INTERNAL
 *   daudau842640@gmail.com        Contributor     INTERNAL
 */
import { PrismaClient, ClearanceLevel, UserStatus, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  const passwordHash = await bcrypt.hash('Admin@123456', saltRounds);

  // --- Phòng ban ---
  const securityDept = await prisma.department.upsert({
    where: { name: 'An ninh thông tin' },
    update: {},
    create: { name: 'An ninh thông tin', description: 'Trung tâm An toàn thông tin' },
  });

  const devDept = await prisma.department.upsert({
    where: { name: 'Khối Phát triển Phần mềm' },
    update: {},
    create: { name: 'Khối Phát triển Phần mềm', description: 'Đội phát triển sản phẩm phần mềm lõi' },
  });

  // --- Demo users (idempotent qua email unique) ---
  const users: Array<{
    email: string;
    fullName: string;
    displayName: string;
    title: string;
    clearance: ClearanceLevel;
    deptId: string;
  }> = [
    {
      email: 'minhchoi2004@gmail.com',
      fullName: 'Mạnh Choi',
      displayName: 'Admin',
      title: 'Administrator',
      clearance: ClearanceLevel.CONFIDENTIAL,
      deptId: securityDept.id,
    },
    {
      email: 'nguyenhuutuon2@gmail.com',
      fullName: 'Nguyễn Hữu Tuấn',
      displayName: 'Tuấn PM',
      title: 'Project Manager',
      clearance: ClearanceLevel.CONFIDENTIAL,
      deptId: devDept.id,
    },
    {
      email: 'duccccccc123123@gmail.com',
      fullName: 'Đức Developer',
      displayName: 'Đức Dev',
      title: 'Developer',
      clearance: ClearanceLevel.INTERNAL,
      deptId: devDept.id,
    },
    {
      email: 'ducngominh2k4@gmail.com',
      fullName: 'Ngô Minh Đức',
      displayName: 'Đức Reviewer',
      title: 'Senior Reviewer',
      clearance: ClearanceLevel.INTERNAL,
      deptId: devDept.id,
    },
    {
      email: 'daudau842640@gmail.com',
      fullName: 'Đậu Contributor',
      displayName: 'Đậu',
      title: 'Contributor',
      clearance: ClearanceLevel.INTERNAL,
      deptId: devDept.id,
    },
  ];

  for (const u of users) {
    await prisma.profile.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        displayName: u.displayName,
        authProvider: AuthProvider.LOCAL,
        departmentId: u.deptId,
        title: u.title,
        clearanceLevel: u.clearance,
        status: UserStatus.ACTIVE,
      },
    });
  }

  // --- Project Template: Phần mềm R&D ---
  const template = await prisma.projectTemplate.upsert({
    where: { templateType: 'SOFTWARE_DEV' },
    update: {},
    create: {
      name: 'Dự án Phần mềm R&D',
      templateType: 'SOFTWARE_DEV',
      description: 'Chuẩn hóa tài liệu cho các dự án phát triển phần mềm nội bộ',
    },
  });

  const rootFolders = [
    { name: '01_SRS', isLocked: true, displayOrder: 1, description: 'Tài liệu đặc tả yêu cầu hệ thống' },
    { name: '02_Design', isLocked: true, displayOrder: 2, description: 'Tài liệu thiết kế' },
    { name: '03_API_Spec', isLocked: true, displayOrder: 3, description: 'Đặc tả API' },
    { name: '04_Test', isLocked: false, displayOrder: 4, description: 'Tài liệu kiểm thử' },
  ];

  for (const f of rootFolders) {
    const exists = await prisma.templateFolder.findFirst({
      where: { templateId: template.id, name: f.name, parentPath: null },
    });
    if (!exists) {
      await prisma.templateFolder.create({
        data: { templateId: template.id, parentPath: null, ...f },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('[VDT-DMS] Seed hoàn tất: 5 demo users + 2 phòng ban + template SOFTWARE_DEV.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
