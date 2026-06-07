import { Link } from 'react-router-dom';
import { BackButton } from '../../shared/ui/BackButton';

/**
 * D6 (Phase 5) — Trang hướng dẫn Policy Builder.
 *  Giải thích từ căn bản đến nâng cao cách ABAC + Casbin hoạt động:
 *    1. ABAC là gì, Casbin là gì
 *    2. Cấu trúc 1 luật (p/g + v0/v1/v2)
 *    3. 5 ví dụ thường gặp + giải thích
 *    4. Workflow: Tạo → Simulator test → Áp dụng
 *    5. Phân biệt p (policy) vs g (grouping/role assignment)
 */
export function PolicyGuidePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <BackButton to="/admin/policies/builder" label="← Về Policy Builder" />

      <div className="bg-gradient-to-r from-viettel-red to-red-700 text-white rounded-lg px-6 py-5">
        <h1 className="text-2xl font-bold">📖 Hướng dẫn Policy Builder + ABAC</h1>
        <p className="text-sm opacity-90 mt-1">
          Toàn bộ những gì bạn cần biết về cấu hình phân quyền trong VDT DMS.
        </p>
      </div>

      {/* §1 ABAC + Casbin căn bản */}
      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-bold">1. ABAC + Casbin là gì?</h2>
        <p className="text-sm text-gray-700">
          <b>ABAC</b> (Attribute-Based Access Control) = phân quyền dựa trên <b>thuộc tính</b> của user
          + tài nguyên + ngữ cảnh. Khác với RBAC truyền thống (chỉ "Admin/User/Guest"), ABAC trả lời
          câu hỏi:
        </p>
        <blockquote className="border-l-4 border-viettel-red pl-4 italic text-gray-600">
          "User có <b>role X</b>, phòng ban <b>Y</b>, clearance <b>Z</b> có được làm hành động <b>A</b>{' '}
          với tài nguyên <b>R</b> trong dự án <b>P</b> vào lúc <b>T</b> không?"
        </blockquote>
        <p className="text-sm text-gray-700">
          <b>Casbin</b> là engine open-source thực thi ABAC. Hệ thống VDT DMS dùng Casbin theo model
          <code className="bg-gray-100 px-1 mx-1 rounded">RBAC + keyMatchPath</code> — kết hợp role
          (grouping) + match path URL như <code>/api/v1/projects/*</code>.
        </p>
      </section>

      {/* §2 Cấu trúc 1 luật */}
      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-bold">2. Cấu trúc 1 luật trong bảng `casbin_rule`</h2>
        <p className="text-sm text-gray-700">
          Mỗi luật là 1 dòng trong DB có dạng:
        </p>
        <div className="bg-gray-900 text-green-300 rounded p-3 text-xs font-mono overflow-auto">
          ptype | v0 (subject) | v1 (object/role) | v2 (action) | v3..v5 (context)
        </div>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Cột</th>
              <th className="px-3 py-2 text-left">Ý nghĩa khi ptype = "p" (policy)</th>
              <th className="px-3 py-2 text-left">Ý nghĩa khi ptype = "g" (grouping)</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs">
            <tr>
              <td className="px-3 py-2 font-mono">ptype</td>
              <td colSpan={2} className="px-3 py-2">
                "p" = policy (cho phép HÀNH ĐỘNG), "g" = grouping (gán role)
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono">v0</td>
              <td className="px-3 py-2">Subject = role name (vd: <code>role_pm_&lt;projectId&gt;</code>)</td>
              <td className="px-3 py-2">User UUID (vd: <code>cd8fb36e-...</code>)</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono">v1</td>
              <td className="px-3 py-2">Object = URL path pattern (vd: <code>/api/v1/projects/*</code>)</td>
              <td className="px-3 py-2">Role name (vd: <code>role_admin</code>)</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono">v2</td>
              <td className="px-3 py-2">
                Action = HTTP method (<code>GET, POST, PATCH, DELETE</code>) hoặc <code>*</code> (mọi
                action)
              </td>
              <td className="px-3 py-2">— (không dùng cho ptype=g)</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono">v3-v5</td>
              <td colSpan={2} className="px-3 py-2">
                Context (chưa dùng) — có thể thêm điều kiện như IP whitelist, time window, etc.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* §3 5 ví dụ thực tế */}
      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-bold">3. 5 ví dụ thường gặp</h2>

        <div className="space-y-3 text-sm">
          <Example
            title="Admin có toàn quyền trên mọi endpoint"
            rules={[
              { ptype: 'g', v0: '<userId của Admin>', v1: 'role_admin' },
              { ptype: 'p', v0: 'role_admin', v1: '/*', v2: '*' },
            ]}
            explain="2 luật: dòng `g` gán user là Admin role, dòng `p` cho role_admin làm mọi thứ. Đã seed sẵn cho minhchoi2004@gmail.com."
          />

          <Example
            title="PM toàn quyền trong dự án của mình"
            rules={[
              { ptype: 'g', v0: '<userId>', v1: 'role_pm_<projectId>' },
              { ptype: 'p', v0: 'role_pm_<projectId>', v1: '/api/v1/projects/<projectId>/*', v2: '*' },
            ]}
            explain="Khi PM tạo project, hệ thống tự sinh 2 luật này. Path pattern matched với keyMatchPath."
          />

          <Example
            title="Reviewer chỉ được duyệt tài liệu"
            rules={[
              { ptype: 'g', v0: '<userId>', v1: 'role_reviewer_<projectId>' },
              {
                ptype: 'p',
                v0: 'role_reviewer_<projectId>',
                v1: '/api/v1/documents/*/review',
                v2: 'POST',
              },
            ]}
            explain="Cho phép gọi POST /documents/:id/review nhưng KHÔNG upload/delete được."
          />

          <Example
            title="Contributor chỉ được upload + xem"
            rules={[
              { ptype: 'g', v0: '<userId>', v1: 'role_contributor_<projectId>' },
              {
                ptype: 'p',
                v0: 'role_contributor_<projectId>',
                v1: '/api/v1/projects/<projectId>/documents/*',
                v2: 'POST',
              },
              { ptype: 'p', v0: 'role_contributor_<projectId>', v1: '/api/v1/documents/*', v2: 'GET' },
            ]}
            explain="2 luật policy + 1 luật grouping. Không cho phép DELETE/PATCH."
          />

          <Example
            title="Viewer chỉ được xem (read-only)"
            rules={[
              { ptype: 'g', v0: '<userId>', v1: 'role_viewer_<projectId>' },
              { ptype: 'p', v0: 'role_viewer_<projectId>', v1: '/api/v1/projects/<projectId>/*', v2: 'GET' },
              { ptype: 'p', v0: 'role_viewer_<projectId>', v1: '/api/v1/documents/*', v2: 'GET' },
            ]}
            explain="Chỉ GET → không edit/delete/upload được."
          />
        </div>
      </section>

      {/* §4 Workflow */}
      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-bold">4. Workflow: Tạo → Test → Áp dụng</h2>
        <ol className="list-decimal ml-6 text-sm space-y-2">
          <li>
            <b>Mở Policy Builder</b> (
            <Link to="/admin/policies/builder" className="text-viettel-red hover:underline">
              /admin/policies/builder
            </Link>
            ).
          </li>
          <li>
            <b>Chọn ptype</b>: "p" nếu muốn cấp/từ chối quyền; "g" nếu muốn gán user vào role.
          </li>
          <li>
            <b>Điền các trường</b>:
            <ul className="list-disc ml-6 mt-1 text-xs text-gray-600">
              <li>Subject = role name hoặc user UUID</li>
              <li>Object = path pattern (dùng <code>*</code> để wildcard)</li>
              <li>Action = HTTP method hoặc <code>*</code></li>
            </ul>
          </li>
          <li>
            <b>Test bằng Simulator</b> ở panel phải trước khi áp dụng. Nhập "Subject + Object +
            Action" của user thật để xem có ALLOW/DENY không, và <b>luật nào match</b>.
          </li>
          <li>
            <b>Bấm "Áp dụng luật"</b> → luật đẩy vào DB casbin_rule + hot-reload Casbin engine.
          </li>
          <li>
            Cache ABAC của user liên quan được tự xóa (TTL 5 phút) — request kế tiếp họ sẽ chạy theo luật mới.
          </li>
        </ol>
      </section>

      {/* §5 Phân biệt p vs g */}
      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-bold">5. Phân biệt p (policy) vs g (grouping)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-semibold text-blue-700 mb-2">ptype = "p" (Policy)</h3>
            <p>
              "Role <b>X</b> được phép làm <b>action Y</b> với <b>resource Z</b>"
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Ví dụ: <code>p, role_pm, /projects/*, *</code> → role_pm có thể GET/POST/PATCH/DELETE
              mọi path bắt đầu bằng /projects/.
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-4">
            <h3 className="font-semibold text-purple-700 mb-2">ptype = "g" (Grouping)</h3>
            <p>
              "User <b>U</b> thuộc role <b>R</b>"
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Ví dụ: <code>g, cd8fb36e-..., role_pm_proj-001</code> → user này có quyền của role_pm
              trong proj-001.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          <b>Chuỗi check ABAC khi user gửi request:</b>
        </p>
        <div className="bg-gray-900 text-green-300 rounded p-3 text-xs font-mono">
          User → tìm các grouping `g` của user → lấy ra list roles<br />
          → với mỗi role, tìm policy `p` matching → kiểm tra path + action<br />
          → nếu có 1 luật match → ALLOW, ngược lại DENY (Default Deny)
        </div>
      </section>

      {/* §6 Lưu ý */}
      <section className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 space-y-2 text-sm">
        <h2 className="font-bold text-yellow-800">⚠️ Lưu ý quan trọng</h2>
        <ul className="list-disc ml-5 space-y-1 text-gray-700">
          <li>
            <b>Default Deny</b> (FR-4.1.3): nếu KHÔNG có luật nào match → từ chối. Không bao giờ "fail
            open".
          </li>
          <li>
            <b>Luật đã seed (locked = true)</b> không thể xóa qua UI — bảo vệ Admin Root không bị mất
            quyền lỡ tay.
          </li>
          <li>
            <b>ABAC enable</b> được điều khiển bằng env <code>ABAC_ENABLED</code>. Mặc định <code>false</code>{' '}
            để dev — AdminGuard vẫn dùng grouping `g, &lt;userId&gt;, role_admin` để check quyền admin
            ở controller-level.
          </li>
          <li>
            <b>Path pattern</b> dùng <code>*</code> để wildcard 1 segment, <code>**</code> không có
            (Casbin keyMatchPath chỉ hỗ trợ 1 sao).
          </li>
        </ul>
      </section>

      <div className="text-center">
        <Link
          to="/admin/policies/builder"
          className="inline-block px-5 py-2 bg-viettel-red text-white rounded font-medium hover:bg-red-700"
        >
          ← Về Policy Builder
        </Link>
      </div>
    </div>
  );
}

function Example({
  title,
  rules,
  explain,
}: {
  title: string;
  rules: Array<{ ptype: string; v0: string; v1: string; v2?: string }>;
  explain: string;
}) {
  return (
    <div className="border rounded p-3 space-y-2">
      <h3 className="font-semibold text-sm">📌 {title}</h3>
      <table className="w-full text-xs font-mono bg-gray-50 rounded overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-2 py-1 text-left">ptype</th>
            <th className="px-2 py-1 text-left">v0</th>
            <th className="px-2 py-1 text-left">v1</th>
            <th className="px-2 py-1 text-left">v2</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={i} className={r.ptype === 'g' ? 'bg-purple-50' : 'bg-blue-50'}>
              <td className="px-2 py-1">
                <span className={`px-1.5 py-0.5 rounded text-white ${r.ptype === 'g' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                  {r.ptype}
                </span>
              </td>
              <td className="px-2 py-1 break-all">{r.v0}</td>
              <td className="px-2 py-1 break-all">{r.v1}</td>
              <td className="px-2 py-1">{r.v2 ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-600">💡 {explain}</p>
    </div>
  );
}
