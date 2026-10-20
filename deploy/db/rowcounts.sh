#!/bin/sh
# Jumlah baris PASTI (COUNT(*)) per tabel: "tabel jumlah". Dipakai gladi migrasi.
# Pemakaian (di dalam kontainer spmi-db): sh rowcounts.sh <nama_db>
DB="$1"
export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
for t in $(mysql -uroot -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB' AND table_type='BASE TABLE' ORDER BY table_name"); do
  echo "$t $(mysql -uroot -N -e "SELECT COUNT(*) FROM \`$t\`" "$DB")"
done
