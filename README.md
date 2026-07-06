# Huong Dan Tu Dau Den Cuoi: Excel -> Postman -> Newman -> GitHub Actions

Project nay giup doi cac test case API dang quan ly bang Excel thanh bo test tu dong co the:

- chay tren may local
- dua len Postman collection
- chay bang Newman
- tu dong chay tren GitHub Actions

Tai lieu nay duoc viet cho nguoi moi, ke ca khi ban chua biet `script` la gi.

## 1. `script` la gi?

`Script` la mot file chua cac lenh duoc viet san de may tinh chay tu dong.

Vi du:

- thay vi moi lan ban tu tay mo Postman va bam tung request
- hoac tu tay doc Excel roi copy body vao Postman

thi script se lam giup minh cac viec do.

Trong project nay, script duoc dung de:

- doc file Excel testcase
- tao Postman collection
- chay Newman
- tao file report HTML/XML/JSON

## 2. Luong tong the dang chay nhu the nao?

```text
File Excel testcase
-> script doc Excel
-> tao Postman collection JSON
-> Newman chay collection
-> tao report
-> GitHub Actions tu dong chay lai khi push code len Git
```

## 3. Cau truc project

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

Y nghia nhanh:

- `postman/POLE_API.postman_collection.json`: file collection de Postman/Newman chay
- `postman/env/dev.postman_environment.json`: noi khai bao `base_url`, `token`, `response_time_sla`
- `scripts/`: noi chua cac file tu dong hoa
- `reports/`: noi chua ket qua sau khi chay test
- `.github/workflows/api-tests.yml`: file GitHub Actions

## 4. Chuan bi truoc khi chay

May can co:

- Node.js
- npm
- Git

Neu dung Windows PowerShell thi nen chay `npm.cmd` thay vi `npm`.

## 5. Chay local tu dau den cuoi

Mo PowerShell tai thu muc:

```powershell
cd "C:\Users\VNTT\Desktop\QC VNTT\CICD"
```

### Buoc 1: cai thu vien

```powershell
npm.cmd install
```

Lenh nay cai Newman va cac thu vien can thiet.

### Buoc 2: tao Postman collection tu file Excel

```powershell
npm.cmd run import:rule-engine
```

Lenh nay se:

- doc file Excel testcase
- chuyen testcase thanh file JSON trung gian
- tao file collection `postman/POLE_API.postman_collection.json`

### Buoc 3: chay test API bang Newman

```powershell
npm.cmd run test:api
```

Lenh nay se:

- mo collection vua tao
- goi cac API
- so sanh ket qua thuc te voi testcase
- tao report

### Buoc 4: xem ket qua

Mo file:

[reports/newman-report.html](<C:/Users/VNTT/Desktop/QC VNTT/CICD/reports/newman-report.html>)

Ban se thay:

- ten testcase
- API dung de lam gi
- method
- URL
- expected result
- actual result
- message tra ve
- response body
- pass/fail

## 6. Dua collection len Postman

Neu ban muon dong bo collection len Postman cloud:

```powershell
$env:POSTMAN_API_KEY="API_KEY_CUA_BAN"
npm.cmd run push:postman
```

Luu y:

- khong commit API key len Git
- chi de API key trong bien moi truong hoac secret

## 7. Day project len Git

Project nay da duoc push len repo:

`https://github.com/HHV01/CICD-Pole-test.git`

Nhanh dang dung:

`feature/rule-engine-api-cicd`

Neu sau nay ban chinh sua code va muon push tiep:

```powershell
git status
git add .
git commit -m "Cap nhat CI/CD Rule Engine"
git push
```

## 8. GitHub Actions dang chay cai gi?

File workflow:

[.github/workflows/api-tests.yml](<C:/Users/VNTT/Desktop/QC VNTT/CICD/.github/workflows/api-tests.yml>)

Khi ban push code len GitHub, workflow se:

1. lay code ve may chu GitHub
2. cai thu vien bang `npm ci`
3. chay `npm run test:api`
4. upload report trong thu muc `reports/`

## 9. Vi sao GitHub Actions cua ban bi loi?

Log ban gui len cho thay job bi fail trong luc chay Newman.

Nguyen nhan quan trong nhat o day la:

- API cua ban dang dung `http://100.70.72.120:7001`
- day la IP noi bo / private network
- GitHub-hosted runner ngoai internet thuong khong truy cap duoc IP nay

Noi de hieu:

- may cua ban o cong ty hoac dang bat VPN thi goi duoc
- may chu GitHub tren cloud thi khong o trong mang noi bo cua ban
- vi vay no khong goi toi API duoc

Khi khong goi toi API duoc, Newman de ra loi kieu:

```text
expected undefined to be one of [404, 422]
```

Thuc chat day khong phai API tra sai logic.
Day la do job khong nhan duoc HTTP response that su.

## 10. Cach xu ly dung cho truong hop cua ban

Ban co 2 huong:

### Cach 1: dung self-hosted runner

Day la cach phu hop nhat neu API chi mo trong mang noi bo.

Y tuong:

- dung 1 may Windows trong cong ty
- may do co the goi duoc `100.70.72.120:7001`
- cai GitHub self-hosted runner tren may do
- workflow se chay tren may cua ban thay vi chay tren server GitHub

Khi do GitHub Actions van su dung duoc, nhung request API se chay tu mang noi bo cua cong ty.

### Cach 2: mo API ra dia chi public

Chi dung cach nay neu duoc phep ve bao mat.

Y tuong:

- doi `base_url` thanh domain/IP public
- GitHub runner co the goi truc tiep

Neu API chua duoc public hoa thi cach nay thuong khong dung duoc.

## 11. Secrets can tao tren GitHub

Vao repo GitHub:

`Settings -> Secrets and variables -> Actions`

Tao cac secret:

- `POLE_BASE_URL`
- `POLE_TOKEN`

Vi du:

- `POLE_BASE_URL = http://100.70.72.120:7001`
- `POLE_TOKEN = <token neu API can>`

Project hien tai da duoc sua de chap nhan ca:

- `POLE_BASE_URL`, `POLE_TOKEN`
- hoac `VMS_BASE_URL`, `VMS_TOKEN`

Nen ban co the dung mot trong hai kieu dat ten bien.

## 12. Neu ban khong biet chac dang loi o dau thi kiem tra theo thu tu nay

1. Chay local bang `npm.cmd run test:api`
2. Neu local pass ma GitHub fail, kha nang cao la do mang/VPN/firewall
3. Kiem tra `POLE_BASE_URL` trong GitHub Secrets da dung chua
4. Kiem tra API co can token khong
5. Kiem tra runner la `ubuntu-latest` hay `self-hosted`

## 13. Lenh dung hang ngay

Cap nhat testcase tu Excel:

```powershell
npm.cmd run import:rule-engine
```

Chay test local:

```powershell
npm.cmd run test:api
```

Dong bo collection len Postman:

```powershell
npm.cmd run push:postman
```

Push code len Git:

```powershell
git add .
git commit -m "Cap nhat test case"
git push
```

## 14. Ban can nho 3 y chinh

1. Excel la noi quan ly testcase goc.
2. Postman/Newman la noi chay testcase tu dong.
3. GitHub Actions chi chay duoc neu runner nhin thay API cua ban.

Neu local pass ma GitHub Actions fail voi IP `100.70.x.x`, gan nhu chac chan can doi sang `self-hosted runner`.
