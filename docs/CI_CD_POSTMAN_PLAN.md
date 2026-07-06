# Ke hoach CI/CD API bang Postman cho he VMS

## Muc tieu

Bien bo test case API dang quan ly bang Excel thanh bo kiem thu tu dong co the chay local va chay trong pipeline. Khi dev push code, merge request, hoac deploy moi truong test, pipeline se tu dong goi API va bao pass/fail.

## Kien truc de xuat

```text
Excel test case
    ↓ chuan hoa / convert
Postman data JSON
    ↓
Postman Collection
    ↓
Newman hoac Postman CLI
    ↓
CI/CD pipeline
    ↓
Report: console + JUnit XML
```

## Mapping tu Excel sang Postman

| Excel | Postman/CI |
| --- | --- |
| Sheet | Folder/module |
| Mã kiểm thử | `caseId` |
| Tên kịch bản kiểm thử | `scenarioTitle` |
| Kịch bản chi tiết | `description` |
| Phương thức | request method |
| Đường dẫn | request path |
| Dữ liệu kiểm thử | request body/query |
| Kết quả mong đợi | `expectedStatus`, `expectedMessage`, `maxResponseTime` |
| Kết quả thực tế | report sinh ra sau khi chạy |
| Tình trạng | không dùng làm source cho CI |

## Lo trinh trien khai

### Giai doan 1 - MVP

Chon module `Rule Engine`, bat dau bang cac API GET doc rule/catalog de smoke test. Dung cac endpoint `GET /api/v1/rules/stats`, `GET /api/v1/rules`, `GET /api/v1/rules/running`, `GET /api/v1/catalog/categories`, `GET /api/v1/catalog/parameters`, chay local cho pass bang Newman.

Ket qua can co:

- Collection `VMS_API.postman_collection.json`.
- Environment `dev.postman_environment.json`.
- Data file cho Rule Engine.
- Report JUnit XML trong `reports/newman-results.xml`.

### Giai doan 2 - Dua vao CI

Them workflow CI de chay khi co pull request, push vao `develop/main`, hoac bam manual run. Bien `base_url` lay tu CI secret `VMS_BASE_URL`.

Ket qua can co:

- Pipeline fail neu HTTP status sai.
- Pipeline fail neu response time vuot nguong.
- Pipeline upload report de trace case loi.

### Giai doan 3 - Mo rong module

Them `Watchlist`, `Event`, `Config`, `PTZ`. Moi module nen co data file rieng de de debug:

```text
postman/VMS_API.postman_collection.json
postman/data/watchlist_cases.json
postman/data/event_cases.json
postman/data/config_cases.json
```

### Giai doan 4 - Quan tri chat luong

Dat quy uoc voi team:

- Case nao expected/actual con mau thuan thi chua dua vao CI.
- Case tao du lieu phai dung gia tri unique, tranh fail do trung du lieu.
- Case xoa/sua nen co buoc setup va cleanup.
- Khong de token/password trong collection.

## Tieu chi hoan thanh

- QA co the chay API regression bang mot lenh.
- Dev co the thay case nao fail trong pipeline.
- Sep co the xem report pass/fail theo lan build.
- Excel van giu vai tro tai lieu, nhung ket qua CI la nguon ket luan cho automation.
