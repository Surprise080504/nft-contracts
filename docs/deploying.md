# Deploy

### Backend

- `./deploy/build-push.sh`
- `ikubectl apply -f apps/backend/deploy/kubernetes.yml`

### Frontend

- `cd apps/frontend`
- `./deploy/build-push.sh`

wait for it to push

- `ikubectl apply -f deploy/kubernetes.yml`
