# Hướng Dẫn Từ Đầu Đến Cuối: Excel -> Postman -> Newman -> GitHub Actions

Project này giúp đổi các test case API đang quản lý bằng Excel thành bộ test tự động có thể:

- chạy trên máy local
- đưa lên Postman collection
- chạy bằng Newman
- tự động chạy trên GitHub Actions

Tài liệu này được viết cho người mới, kể cả khi bạn chưa biết `script` là gì.

## 1. `script` là gì?

`Script` là một file chứa các lệnh được viết sẵn để máy tính chạy tự động.

Ví dụ:

- thay vì mỗi lần bạn tự tay mở Postman và bấm từng request
- hoặc tự tay đọc Excel rồi copy body vào Postman

thì script sẽ làm giúp mình các việc đó.

Trong project này, script được dùng để:

- đọc file Excel testcase
- tạo Postman collection
- chạy Newman
- tạo file report HTML/XML/JSON

## 2. Luồng tổng thể đang chạy như thế nào?

```text
File Excel testcase
-> script đọc Excel
-> tạo Postman collection JSON
-> Newman chạy collection
-> tạo report
-> GitHub Actions tự động chạy lại khi push code lên Git
```

## 3. Cấu trúc project

```text
CICD/
  .github/workflows/api-tests.yml
  postman/
    POLE_API.postman_collection.json
    env/dev.postman_environment.json
    data/rule-engine-api-testcases.json
  scripts/
    extract-rule-engine-testcases.ps1
    rule-engine-cases-to-postman.mjs
    run-newman-and-report.mjs
    newman-json-to-html.mjs
    push-to-postman-collection.ps1
  reports/
  package.json
  README.md
```

Ý nghĩa nhanh:

- `postman/POLE_API.postman_collection.json`: file collection để Postman/Newman chạy
- `postman/env/dev.postman_environment.json`: nơi khai báo `base_url`, `token`, `response_time_sla`
- `scripts/`: nơi chứa các file tự động hóa
- `reports/`: nơi chứa kết quả sau khi chạy test
- `.github/workflows/api-tests.yml`: file GitHub Actions

## 4. Chuẩn bị trước khi chạy

Máy cần có:

- Node.js
- npm
- Git

Nếu dùng Windows PowerShell thì nên chạy `npm.cmd` thay vì `npm`.

## 5. Chạy local từ đầu đến cuối

Mở PowerShell tại thư mục:

```powershell
cd "C:\duong-dan-den-thu-muc-cua-ban\CICD"
```

### Bước 1: cài thư viện

```powershell
npm.cmd install
```

Lệnh này cài Newman và các thư viện cần thiết.

### Bước 2: tạo Postman collection từ file Excel

```powershell
npm.cmd run import:rule-engine
```

Lệnh này sẽ:

- đọc file Excel testcase
- chuyển testcase thành file JSON trung gian
- tạo file collection `postman/POLE_API.postman_collection.json`

### Bước 3: chạy test API bằng Newman

```powershell
npm.cmd run test:api
```

Lệnh này sẽ:

- mở collection vừa tạo
- gọi các API
- so sánh kết quả thực tế với testcase
- tạo report

### Bước 4: xem kết quả

Mở file:

[reports/newman-report.html](reports/newman-report.html)

Bạn sẽ thấy:

- tên testcase
- API dùng để làm gì
- method
- URL
- expected result
- actual result
- message trả về
- response body
- pass/fail

## 6. Đưa collection lên Postman

Nếu bạn muốn đồng bộ collection lên Postman cloud:

```powershell
$env:POSTMAN_API_KEY="API_KEY_CUA_BAN"
npm.cmd run push:postman
```

Lưu ý:

- không commit API key lên Git
- chỉ để API key trong biến môi trường hoặc secret

## 7. Đẩy project lên Git

Project này đã được push lên repo:

`https://github.com/HHV01/CICD-Pole-test.git`

Nhánh đang dùng:

`feature/rule-engine-api-cicd`

Nếu sau này bạn chỉnh sửa code và muốn push tiếp:

```powershell
git status
git add .
git commit -m "Cập nhật CI/CD Rule Engine"
git push
```

## 8. GitHub Actions đang chạy cái gì?

File workflow:

[.github/workflows/api-tests.yml](.github/workflows/api-tests.yml)

Khi bạn push code lên GitHub, workflow sẽ:

1. lấy code về máy runner của bạn
2. cài thư viện bằng `npm.cmd ci`
3. chạy `npm.cmd run test:api`
4. upload report trong thư mục `reports/`

Trong project này, workflow đã được đổi sang:

```yaml
runs-on: [self-hosted, windows, x64]
```

Điều này có nghĩa là GitHub sẽ không chạy trên máy chủ cloud mặc định nữa, mà sẽ cho một máy Windows nội bộ của bạn nhận job và chạy.

## 9. Vì sao phải đổi sang self-hosted runner?

Nguyên nhân quan trọng nhất là:

- API của bạn đang dùng `http://100.70.72.120:7001`
- đây là IP nội bộ / private network
- GitHub-hosted runner ngoài internet thường không truy cập được IP này

Nói dễ hiểu:

- máy của bạn ở công ty hoặc đang bật VPN thì gọi được
- máy chủ GitHub trên cloud thì không ở trong mạng nội bộ của bạn
- vì vậy nó không gọi tới API được

Khi không gọi tới API được, Newman dễ ra lỗi kiểu:

```text
expected undefined to be one of [404, 422]
```

Thực chất đây không phải API trả sai logic.  
Đây là do job không nhận được HTTP response thật sự.

## 10. Cách cài self-hosted runner trên máy Windows nội bộ

Bạn làm đúng thứ tự này:

1. Mở repo GitHub của bạn:
   `https://github.com/HHV01/CICD-Pole-test`

2. Vào:
   `Settings -> Actions -> Runners -> New self-hosted runner`

3. Chọn:
   `Windows`
   `x64`

4. GitHub sẽ hiện ra 3 nhóm bước:
   `Download`
   `Configure`
   `Run`

5. Trên máy Windows trong mạng nội bộ, mở PowerShell và chạy lần lượt các lệnh GitHub đưa ra.

Thường nó sẽ có dạng như:

```powershell
mkdir C:\actions-runner
cd C:\actions-runner
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/... -OutFile actions-runner-win-x64.zip
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD\actions-runner-win-x64.zip", "$PWD")
.\config.cmd --url https://github.com/HHV01/CICD-Pole-test --token TOKEN_GITHUB_CAP
.\run.cmd
```

Nếu `Invoke-WebRequest` báo lỗi nhưng file zip vẫn tải về được, bạn có thể tiếp tục sau khi kiểm tra thấy file `.zip` đã nằm trong thư mục `C:\actions-runner`.

6. Token để chạy `.\config.cmd` không phải tự tạo tay.  
Token này nằm ngay trong trang `New self-hosted runner`, ở dòng lệnh:

```powershell
.\config.cmd --url https://github.com/HHV01/CICD-Pole-test --token XXXXX
```

Phần `XXXXX` sau `--token` chính là token cần dùng.

7. Khi GitHub hỏi label, giữ mặc định hoặc thêm:
   `windows`
   `x64`
   `internal-network`

8. Sau khi xong, trên trang GitHub repo sẽ thấy runner ở trạng thái `Idle`

9. Lúc này bạn push code hoặc bấm `Run workflow`, job sẽ chạy trên máy nội bộ đó.

10. Dấu hiệu cài thành công:

- `Runner successfully added`
- `Connected to GitHub`
- `Listening for Jobs`

## 11. Nếu muốn runner tự chạy nền mà không cần mở cửa sổ

Sau khi test `.\run.cmd` chạy ổn, bạn có thể cài nó thành service:

```powershell
.\svc install
.\svc start
```

Khi đó runner sẽ tự động chạy cùng Windows.

## 12. Secrets cần tạo trên GitHub

Vào repo GitHub:

`Settings -> Secrets and variables -> Actions`

Lưu ý:

- phải bấm tab `Secrets`
- không tạo ở tab `Variables`

Tạo các secret:

- `POLE_BASE_URL`
- `POLE_TOKEN`

Ví dụ:

- `POLE_BASE_URL = http://100.70.72.120:7001`
- `POLE_TOKEN = <token nếu API cần>`

Vì workflow đã chạy trên máy nội bộ, runner sẽ gọi được link này nếu máy đó đang cùng mạng hoặc đang bật VPN.

Project hiện tại sử dụng các biến môi trường chính:

- `POLE_BASE_URL`
- `POLE_TOKEN`

## 13. Nếu bạn không biết chắc đang lỗi ở đâu thì kiểm tra theo thứ tự này

1. Chạy local bằng `npm.cmd run test:api`
2. Kiểm tra máy cài runner có gọi được `http://100.70.72.120:7001` trên browser hoặc Postman không
3. Kiểm tra runner trên GitHub đang `Idle` hay `Offline`
4. Kiểm tra `POLE_BASE_URL` trong GitHub Secrets đã đúng chưa
5. Kiểm tra API có cần token không
6. Nếu `config.cmd` hoặc `run.cmd` không tồn tại, kiểm tra lại bước giải nén file zip

## 14. Lệnh dùng hằng ngày

Cập nhật testcase từ Excel:

```powershell
npm.cmd run import:rule-engine
```

Chạy test local:

```powershell
npm.cmd run test:api
```

Đồng bộ collection lên Postman:

```powershell
npm.cmd run push:postman
```

Push code lên Git:

```powershell
git add .
git commit -m "Cập nhật test case"
git push
```

## 15. Nếu muốn áp dụng cho API khác thì làm như thế nào?

Repo này hiện đang chạy tốt cho bộ testcase Rule Engine, nhưng hoàn toàn có thể dùng tiếp cho API khác nếu bạn đi theo cùng cách tổ chức.

### Những phần có thể giữ nguyên

- GitHub Actions workflow trong `.github/workflows/api-tests.yml`
- self-hosted runner
- cách tạo `Secrets` trên GitHub
- cách chạy Newman và sinh report
- cấu trúc thư mục `postman/`, `scripts/`, `reports/`

### Những phần cần thay đổi khi chuyển sang API khác

1. File Excel testcase
   - vẫn nên giữ cùng format cột như hiện tại
   - nếu đổi format cột, cần sửa script `scripts/extract-rule-engine-testcases.ps1`

2. File dữ liệu JSON trung gian
   - hiện đang sinh ra file:
     `postman/data/rule-engine-api-testcases.json`
   - nếu làm API khác, bạn có thể tạo file mới theo module khác, ví dụ:
     `postman/data/module-khac-api-testcases.json`

3. File Postman collection
   - hiện tại đang dùng:
     `postman/POLE_API.postman_collection.json`
   - nếu muốn tách riêng từng module, có thể tạo collection khác như:
     `postman/MODULE_KHAC_API.postman_collection.json`
     `postman/EVENT_API.postman_collection.json`

4. Script sinh collection
   - file hiện tại:
     `scripts/rule-engine-cases-to-postman.mjs`
   - file này đang có logic đặt tên folder theo mã case như:
     `RE-READ`, `RE-LC`, `RE-EDGE`
   - nếu API khác dùng prefix khác, cần sửa phần `groupName()` và các rule kiểm tra tương ứng

5. Logic kiểm tra response
   - hiện tại script đang kiểm tra theo kiểu phù hợp với Rule Engine:
     - expected status
     - response time
     - response JSON
     - một số điều kiện như `rule_id`
   - nếu API khác có kiểu dữ liệu khác, flow khác, hoặc không có `rule_id`, cần sửa phần assertion trong:
     `scripts/rule-engine-cases-to-postman.mjs`

6. Environment variables
   - hiện tại workflow đọc:
     `POLE_BASE_URL`
     `POLE_TOKEN`
   - nếu API khác dùng base URL khác, chỉ cần đổi secret tương ứng hoặc tạo environment khác

### Cách mở rộng an toàn nhất

Cách dễ nhất là:

1. copy bộ hiện tại của Rule Engine
2. đổi tên file data / collection theo module mới
3. chỉnh phần mapping testcase
4. chạy local trước bằng Newman
5. khi local pass rồi mới đưa lên GitHub Actions

### Ví dụ nếu làm thêm một module API khác

Bạn có thể đi theo hướng này:

- Excel:
  `module-khac-api-testcases.xlsx`
- JSON trung gian:
  `postman/data/module-khac-api-testcases.json`
- Collection:
  `postman/MODULE_KHAC_API.postman_collection.json`
- Script sinh collection:
  `scripts/module-khac-cases-to-postman.mjs`

Sau đó thêm script trong `package.json`, ví dụ:

```json
{
  "scripts": {
    "import:module-khac": "powershell -ExecutionPolicy Bypass -File scripts/extract-rule-engine-testcases.ps1 -ExcelPath \"C:\\duong-dan\\module-khac-api-testcases.xlsx\" -OutputPath \"postman/data/module-khac-api-testcases.json\" && node scripts/module-khac-cases-to-postman.mjs",
    "test:module-khac": "node scripts/run-newman-and-report.mjs"
  }
}
```

### Khi nào cần sửa ít, khi nào cần sửa nhiều?

Sửa ít khi:

- API mới vẫn dùng cùng format Excel
- request/response đều là JSON
- chỉ khác endpoint, method, body và expected status

Sửa nhiều khi:

- API mới có flow nhiều bước phụ thuộc nhau
- cần login trước rồi mới gọi API
- response không phải JSON
- có upload file
- có streaming
- có xác thực khác Rule Engine

### Kết luận cho phần mở rộng

Repo này bây giờ đóng vai trò như một `starter kit` cho:

- Excel testcase
- Postman collection
- Newman
- self-hosted GitHub Actions

Nó dùng rất tốt cho Rule Engine, và có thể mở rộng sang API khác mà không cần làm lại từ đầu.

## 16. Bạn cần nhớ 3 ý chính

1. Excel là nơi quản lý testcase gốc.
2. Postman/Newman là nơi chạy testcase tự động.
3. Với API nội bộ, GitHub Actions chỉ chạy được khi dùng `self-hosted runner`.

Nếu bạn muốn, bước tiếp theo mình có thể sửa thêm workflow để chỉ chạy trên runner có label riêng, ví dụ:

```yaml
runs-on: [self-hosted, windows, x64, internal-network]
```
