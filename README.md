# DigiWallet PPOB

Aplikasi digital wallet untuk transaksi PPOB (Payment Point Online Bank) seperti pembelian pulsa, paket data, dan token listrik.

## Tech Stack

- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** React 19, Vite, Tailwind CSS
- **Monitoring:** Prometheus, Grafana
- **Deployment:** Docker, Docker Compose

## Cara Menjalankan

### Backend
```bash
cd Backend
cp .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd Frontend/digiwallet
cp .env.example .env
npm install
npm run dev
```

### Docker
```bash
docker-compose up -d
```