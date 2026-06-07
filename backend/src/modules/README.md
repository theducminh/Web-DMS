# modules/ — Các phân hệ API (Phase 3)

Mỗi module = một domain nghiệp vụ, ánh xạ tới các luồng trong `docs/architecture/`:

| Module | Luồng | Nội dung |
| --- | --- | --- |
| `auth/` | 1, 2, 3, 4 | Login, Register, Verify, Forgot Password, Google SSO, JWT strategy |
| `profile/` | 5, 6 | Cập nhật thông tin, đổi mật khẩu, quản lý/hủy phiên (Redis) |
| `admin/` | 7, 8, 9, 26 | User Directory, gán thuộc tính ABAC, Departments, Project Templates |
| `projects/` | 10, 11, 13, 14 | Portfolio, Init, Members, Archive/Restore |
| `documents/` | 12, 15, 16, 18 | Folder Navigator, Upload Stream, Pessimistic Lock, Diff |
| `workflow/` | 17 | Approve/Reject & FSM (Finite State Machine) |
| `releases/` | 19, 20 | Khởi tạo gói Release, Snapshot, chấm điểm tuân thủ, Export |
| `policies/` | 21, 22 | Casbin Policy Manager, Visual Rule Builder, Simulator |
| `security/` | 23, 24, 25 | Audit Ledger, Export Stream, Lockdown, quét đứt gãy Hash |
| `search/` | (Global) | Full-Text Search qua pg_trgm |

Mỗi module thường gồm: `*.controller.ts`, `*.service.ts`, `dto/`, và (nếu cần) `*.strategy.ts`.
