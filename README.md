# VMS API CI/CD Starter Kit

Bo file nay la huong lam de chuyen test case API Rule Engine sang Postman collection chay tu dong trong CI/CD. Ban dau dung GET smoke test de de chay va tranh tao du lieu.

## Huong di de xuat

1. Giu Excel lam tai lieu nghiep vu va lich su test case.
2. Chuan hoa cac case can automation thanh JSON data file.
3. Tao Postman collection theo module, moi request doc du lieu tu data file.
4. Chay local truoc bang Newman/Postman CLI.
5. Dua vao pipeline de moi lan merge/deploy thi API test tu dong chay.

## Cau truc thu muc

```text
.
├── .github/workflows/api-tests.yml
├── docs/CI_CD_POSTMAN_PLAN.md
├── postman/
│   ├── VMS_API.postman_collection.json
│   └── env/dev.postman_environment.json
├── scripts/convert-excel-to-postman-data.ps1
└── package.json
```

## Chay nhanh local

May hien tai co Node, nhung PowerShell dang chan `npm.ps1` va `npx.ps1`, vi vay tren Windows nen dung `npm.cmd` / `npx.cmd`.

```powershell
npm.cmd install
npm.cmd run test:api
```

Lenh tren se chay:

```powershell
newman run postman/VMS_API.postman_collection.json `
  -e postman/env/dev.postman_environment.json `
  --reporters cli,junit,json `
  --reporter-junit-export reports/newman-results.xml
```

Can sua truoc bien `base_url` trong environment hoac truyen qua CI secret `VMS_BASE_URL`.

Report de doc cho nguoi xem:

```text
reports/newman-report.html
```

Report XML `reports/newman-results.xml` la JUnit report cho CI/CD doc, nen mo bang browser se hien XML thuan va nhin rat roi. Neu muon xem bang mat nguoi, hay mo file HTML.

## Data Rule Engine

Import testcase tu Excel:

```powershell
npm.cmd run import:rule-engine
```

Endpoint goc lay tu Swagger Rule Engine moi. Smoke test dang dung:

```text
GET http://100.70.72.120:7001/api/v1/rules/stats
GET http://100.70.72.120:7001/api/v1/rules
GET http://100.70.72.120:7001/api/v1/rules/running
GET http://100.70.72.120:7001/api/v1/catalog/categories
GET http://100.70.72.120:7001/api/v1/catalog/parameters
```

Khi co them test case Rule Engine tu Excel hoac swagger, nen chuan hoa vao cac truong:

```text
requestName | method | path | expected status | expected data type | response time SLA
```

## Day truc tiep len collection Postman

Neu muon cap nhat truc tiep collection `CICD` tren Postman cloud, can co:

- `Postman API key` cua tai khoan co quyen edit collection.
- Link collection hoac collection UID.

Chay:

```powershell
$env:POSTMAN_API_KEY="PMAK_xxx"
powershell -ExecutionPolicy Bypass -File scripts/push-to-postman-collection.ps1 `
  -CollectionUrl "PASTE_COLLECTION_LINK_HERE" `
  -SourcePath postman/VMS_API.postman_collection.json
```

Script se backup collection hien tai vao `postman/backups/` truoc khi update.

## Quy tac automation

- Khong lay cot `Actual Results` lam expected cho CI.
- Tach expected thanh cac truong may doc duoc: `expectedStatus`, `expectedBodyStatusCode`, `expectedMessage`, `maxResponseTime`.
- Secret nhu `token`, `username`, `password` dua vao CI secrets, khong commit vao repo.
- Bat dau voi Rule Engine, sau do nhan rong sang cac API lien quan Event/Rule.
