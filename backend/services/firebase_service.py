"""
ParaPusula - Firebase Firestore Servisi
Kullanıcı profilleri, finansal snapshot'lar ve TCMB cache'ini yönetir.
Firebase Admin SDK sync işlemleri asyncio.to_thread ile wrap edilir.
"""

import os
import asyncio
from typing import Optional
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

from models.schemas import UserProfile, FinancialSnapshot, TCMBData

load_dotenv()


class FirebaseService:
    """
    Firebase Firestore ile tüm veri okuma/yazma işlemlerini yöneten servis.
    Singleton pattern ile tek instance kullanılır.
    """

    def __init__(self):
        # Lazy init: db bağlantısı ilk çağrıda kurulur
        self._db = None

    def _get_db(self):
        """Firestore client'ını lazy olarak başlatır."""
        if self._db is not None:
            return self._db

        # Firebase zaten başlatılmışsa yeniden başlatma
        if not firebase_admin._apps:
            # Ortam değişkenlerinden credential dict oluştur
            cred_dict = {
                "type": "service_account",
                "project_id": os.getenv("FIREBASE_PROJECT_ID", ""),
                "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", ""),
                "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
                "client_email": os.getenv("FIREBASE_CLIENT_EMAIL", ""),
                "client_id": os.getenv("FIREBASE_CLIENT_ID", ""),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.getenv('FIREBASE_CLIENT_EMAIL', '')}",
                "universe_domain": "googleapis.com"
            }

            try:
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
            except Exception as e:
                raise RuntimeError(f"Firebase başlatma hatası: {e}")

        self._db = firestore.client()
        return self._db

    @property
    def db(self):
        return self._get_db()

    # ─────────────────────────────────────────────
    # Kullanıcı Profili İşlemleri
    # ─────────────────────────────────────────────

    async def kullanici_profil_kaydet(self, profil: UserProfile) -> None:
        """
        Kullanıcı profilini Firestore'a kaydeder.
        Koleksiyon: users/{userId}/profile
        """
        try:
            profil_dict = profil.model_dump()

            def _kaydet():
                self.db.collection("users").document(profil.user_id)\
                    .collection("profile").document("main").set(profil_dict)

            await asyncio.to_thread(_kaydet)
        except Exception as e:
            raise RuntimeError(f"Profil kaydetme hatası: {e}")

    async def kullanici_profil_oku(self, user_id: str) -> Optional[UserProfile]:
        """
        Kullanıcı profilini Firestore'dan okur.
        Bulunamazsa None döndürür.
        """
        try:
            def _oku():
                doc = self.db.collection("users").document(user_id)\
                    .collection("profile").document("main").get()
                return doc.to_dict() if doc.exists else None

            profil_dict = await asyncio.to_thread(_oku)

            if profil_dict is None:
                return None

            return UserProfile(**profil_dict)
        except Exception as e:
            raise RuntimeError(f"Profil okuma hatası: {e}")

    # ─────────────────────────────────────────────
    # Finansal Snapshot İşlemleri
    # ─────────────────────────────────────────────

    async def snapshot_kaydet(self, snapshot: FinancialSnapshot) -> None:
        """
        Finansal snapshot'ı Firestore'a kaydeder.
        Koleksiyon: users/{userId}/snapshots/{ay}
        """
        try:
            snapshot_dict = snapshot.model_dump()
            print(f"[FIREBASE] Snapshot yazılıyor → users/{snapshot.user_id}/snapshots/{snapshot.ay}")

            def _kaydet():
                self.db.collection("users").document(snapshot.user_id)\
                    .collection("snapshots").document(snapshot.ay).set(snapshot_dict)

            await asyncio.to_thread(_kaydet)
            print(f"[FIREBASE] Snapshot başarıyla yazıldı ✓")
        except Exception as e:
            print(f"[FIREBASE] HATA snapshot_kaydet: {e}")
            raise RuntimeError(f"Snapshot kaydetme hatası: {e}")

    async def snapshot_oku(self, user_id: str, ay: str) -> Optional[FinancialSnapshot]:
        """
        Belirli bir aya ait finansal snapshot'ı okur.
        Bulunamazsa None döndürür.
        """
        try:
            def _oku():
                doc = self.db.collection("users").document(user_id)\
                    .collection("snapshots").document(ay).get()
                return doc.to_dict() if doc.exists else None

            snapshot_dict = await asyncio.to_thread(_oku)

            if snapshot_dict is None:
                return None

            return FinancialSnapshot(**snapshot_dict)
        except Exception as e:
            raise RuntimeError(f"Snapshot okuma hatası: {e}")

    async def son_snapshot_oku(self, user_id: str) -> Optional[FinancialSnapshot]:
        """
        Kullanıcının en son (güncel) finansal snapshot'ını döndürür.
        Snapshots koleksiyonundan en yeni belgeyi getirir.
        """
        try:
            print(f"[FIREBASE] Son snapshot okunuyor → users/{user_id}/snapshots/")

            def _oku():
                docs = self.db.collection("users").document(user_id)\
                    .collection("snapshots")\
                    .order_by("olusturulma_tarihi", direction=firestore.Query.DESCENDING)\
                    .limit(1)\
                    .stream()
                for doc in docs:
                    print(f"[FIREBASE] Snapshot bulundu: doc_id={doc.id}")
                    return doc.to_dict()
                print(f"[FIREBASE] Snapshot bulunamadı: users/{user_id}/snapshots/ boş")
                return None

            snapshot_dict = await asyncio.to_thread(_oku)

            if snapshot_dict is None:
                return None

            return FinancialSnapshot(**snapshot_dict)
        except Exception as e:
            print(f"[FIREBASE] HATA son_snapshot_oku: {e}")
            raise RuntimeError(f"Son snapshot okuma hatası: {e}")

    async def analiz_guncelle(
        self,
        user_id: str,
        ay: str,
        oneriler: list,
        borc_plan: Optional[dict],
        toplam_tasarruf_onerisi: float = 0.0,
        ekstra_odeme_onerisi: float = 0.0,
    ) -> None:
        """
        Snapshot'a öneri ve borç planı bilgisini ekler/günceller.
        update() yerine set(merge=True) kullanılır — belge yoksa da çalışır.
        """
        try:
            guncelleme_dict = {
                "oneriler": oneriler,
                "borc_cikis_plani": borc_plan,
                "toplam_tasarruf_onerisi": toplam_tasarruf_onerisi,
                "ekstra_odeme_onerisi": ekstra_odeme_onerisi,
                "guncelleme_tarihi": datetime.now().isoformat()
            }

            print(f"[FIREBASE] analiz_guncelle → users/{user_id}/snapshots/{ay}")
            print(f"[FIREBASE] Öneri sayısı: {len(oneriler)}, Borç planı: {'var' if borc_plan else 'yok'}")

            def _guncelle():
                # set(merge=True): document yoksa oluşturur, varsa sadece belirtilen alanları günceller
                self.db.collection("users").document(user_id)\
                    .collection("snapshots").document(ay).set(guncelleme_dict, merge=True)

            await asyncio.to_thread(_guncelle)
            print(f"[FIREBASE] analiz_guncelle başarılı ✓")
        except Exception as e:
            print(f"[FIREBASE] HATA analiz_guncelle: {e}")
            raise RuntimeError(f"Analiz güncelleme hatası: {e}")

    async def snapshot_listesi_oku(self, user_id: str, limit: int = 2) -> list:
        """
        Kullanıcının en son N snapshot'ını ham dict olarak listeler (tarihe göre azalan).
        Aylık kıyaslama için kullanılır.
        """
        try:
            def _oku():
                docs = self.db.collection("users").document(user_id)\
                    .collection("snapshots")\
                    .order_by("olusturulma_tarihi", direction=firestore.Query.DESCENDING)\
                    .limit(limit)\
                    .stream()
                return [doc.to_dict() for doc in docs if doc.exists]

            return await asyncio.to_thread(_oku)
        except Exception as e:
            raise RuntimeError(f"Snapshot listesi okuma hatası: {e}")

    async def abonelik_puani_kaydet(
        self, user_id: str, adi: str, puan: int, tutar: float
    ) -> None:
        """
        Abonelik kullanım puanını Firestore'a kaydeder.
        Yol: users/{userId}/subscriptions/{adi_normalize}
        """
        try:
            # Abonelik adını Firestore-safe doc id'ye çevir
            doc_id = adi.lower().replace(" ", "_").replace("/", "_")[:64]
            veri = {
                "adi": adi,
                "puan": puan,
                "tutar": tutar,
                "guncelleme_tarihi": datetime.now().isoformat()
            }

            def _kaydet():
                self.db.collection("users").document(user_id)\
                    .collection("subscriptions").document(doc_id)\
                    .set(veri, merge=True)

            await asyncio.to_thread(_kaydet)
        except Exception as e:
            raise RuntimeError(f"Abonelik puanı kaydetme hatası: {e}")

    # ─────────────────────────────────────────────
    # Birikim Hedefi İşlemleri
    # ─────────────────────────────────────────────

    async def hedef_listesi_oku(self, user_id: str) -> list:
        """
        Kullanıcının tüm birikim hedeflerini okur.
        Yol: users/{userId}/goals/
        """
        try:
            def _oku():
                docs = self.db.collection("users").document(user_id)\
                    .collection("goals").stream()
                return [{"id": doc.id, **doc.to_dict()} for doc in docs]

            return await asyncio.to_thread(_oku)
        except Exception as e:
            raise RuntimeError(f"Hedef listesi okuma hatası: {e}")

    async def hedef_kaydet(self, user_id: str, hedef: dict) -> str:
        """
        Yeni birikim hedefi oluşturur. Firestore auto-id döndürür.
        Yol: users/{userId}/goals/{autoId}
        """
        try:
            veri = {
                "ad":           hedef.get("ad", "Hedef"),
                "hedef_tutar":  float(hedef.get("hedef_tutar", 0)),
                "aciklama":     hedef.get("aciklama", ""),
                "fotograf_url": hedef.get("fotograf_url", ""),
                "birikimler":   [],
                "toplam_birikim": 0.0,
                "olusturma_tarihi": datetime.now().isoformat(),
            }

            def _kaydet():
                ref = self.db.collection("users").document(user_id)\
                    .collection("goals").add(veri)
                return ref[1].id  # add() → (timestamp, ref)

            return await asyncio.to_thread(_kaydet)
        except Exception as e:
            raise RuntimeError(f"Hedef kaydetme hatası: {e}")

    async def hedef_guncelle(self, user_id: str, hedef_id: str, guncellemeler: dict) -> None:
        """
        Hedefin ad/tutar/açıklama/fotoğraf alanlarını günceller.
        birikimler ve toplam_birikim alanlarına dokunmaz.
        """
        try:
            izin_verilen = {"ad", "hedef_tutar", "aciklama", "fotograf_url"}
            temiz = {k: v for k, v in guncellemeler.items() if k in izin_verilen}
            if not temiz:
                return

            def _guncelle():
                self.db.collection("users").document(user_id)\
                    .collection("goals").document(hedef_id).update(temiz)

            await asyncio.to_thread(_guncelle)
        except Exception as e:
            raise RuntimeError(f"Hedef güncelleme hatası: {e}")

    async def hedef_sil(self, user_id: str, hedef_id: str) -> None:
        """Birikim hedefini Firestore'dan siler."""
        try:
            def _sil():
                self.db.collection("users").document(user_id)\
                    .collection("goals").document(hedef_id).delete()

            await asyncio.to_thread(_sil)
        except Exception as e:
            raise RuntimeError(f"Hedef silme hatası: {e}")

    async def birikim_ekle(
        self, user_id: str, hedef_id: str, ay: str, tutar: float
    ) -> None:
        """
        Hedefe aylık birikim ekler veya aynı ayın üzerine yazar.
        Toplam_birikim otomatik güncellenir.
        Yol: users/{userId}/goals/{hedefId}
        """
        try:
            def _guncelle():
                ref = self.db.collection("users").document(user_id)\
                    .collection("goals").document(hedef_id)
                doc = ref.get()
                if not doc.exists:
                    raise ValueError(f"Hedef bulunamadı: {hedef_id}")

                mevcut = doc.to_dict()
                birikimler = list(mevcut.get("birikimler", []))

                # Aynı ay varsa üzerine yaz
                ay_var = False
                for i, b in enumerate(birikimler):
                    if b.get("ay") == ay:
                        birikimler[i] = {"ay": ay, "tutar": tutar}
                        ay_var = True
                        break
                if not ay_var:
                    birikimler.append({"ay": ay, "tutar": tutar})

                toplam = sum(b["tutar"] for b in birikimler)
                ref.update({"birikimler": birikimler, "toplam_birikim": toplam})

            await asyncio.to_thread(_guncelle)
        except Exception as e:
            raise RuntimeError(f"Birikim ekleme hatası: {e}")

    async def abonelik_puanlari_oku(self, user_id: str) -> dict:
        """
        Kullanıcının tüm abonelik puanlarını okur.
        Dönüş: {adi: {puan, tutar}}
        """
        try:
            def _oku():
                docs = self.db.collection("users").document(user_id)\
                    .collection("subscriptions").stream()
                return {doc.id: doc.to_dict() for doc in docs}

            return await asyncio.to_thread(_oku)
        except Exception as e:
            raise RuntimeError(f"Abonelik puanları okuma hatası: {e}")

    async def snapshot_ham_oku(self, user_id: str, ay: str) -> Optional[dict]:
        """
        Belirtilen aydaki snapshot'ı ham dict olarak döndürür (Pydantic'e geçirmeden).
        Recalculate endpoint'i için kullanılır.
        """
        try:
            def _oku():
                doc = self.db.collection("users").document(user_id)\
                    .collection("snapshots").document(ay).get()
                return doc.to_dict() if doc.exists else None

            return await asyncio.to_thread(_oku)
        except Exception as e:
            raise RuntimeError(f"Ham snapshot okuma hatası: {e}")

    async def snapshot_guncelle(self, user_id: str, ay: str, guncellemeler: dict) -> None:
        """Ham dict ile snapshot'ın istenen alanlarını günceller."""
        try:
            def _guncelle():
                self.db.collection("users").document(user_id)\
                    .collection("snapshots").document(ay).set(guncellemeler, merge=True)

            await asyncio.to_thread(_guncelle)
        except Exception as e:
            raise RuntimeError(f"Snapshot güncelleme hatası: {e}")

    # ─────────────────────────────────────────────
    # Borç Faiz Oranı (Manuel Giriş)
    # ─────────────────────────────────────────────

    @staticmethod
    def _borc_doc_id(borc_adi: str) -> str:
        """Firestore doc ID için '/' karakterini '_' ile değiştir, 100 char sınırla."""
        return borc_adi.replace("/", "_").strip()[:100]

    async def borc_faiz_kaydet(self, user_id: str, borc_adi: str, faiz_yillik: float) -> None:
        """users/{userId}/borc_detaylari/{borc_adi} → {faiz_yillik}"""
        try:
            doc_id = self._borc_doc_id(borc_adi)
            def _yaz():
                self.db.collection("users").document(user_id)\
                    .collection("borc_detaylari").document(doc_id)\
                    .set({"borc_adi": borc_adi, "faiz_yillik": faiz_yillik}, merge=True)
            await asyncio.to_thread(_yaz)
        except Exception as e:
            raise RuntimeError(f"Borç faiz kaydetme hatası: {e}")

    async def borc_detaylari_oku(self, user_id: str) -> dict:
        """
        Kullanıcının tüm manuel faiz oranlarını döndürür.
        Döner: {borc_adi: faiz_yillik, ...}
        """
        try:
            def _oku():
                docs = self.db.collection("users").document(user_id)\
                    .collection("borc_detaylari").stream()
                return {d.to_dict().get("borc_adi", d.id): d.to_dict().get("faiz_yillik")
                        for d in docs}
            return await asyncio.to_thread(_oku)
        except Exception:
            return {}

    # ─────────────────────────────────────────────
    # Insight (Vay Be Anı) Takibi
    # ─────────────────────────────────────────────

    async def insight_ay_oku(self, user_id: str) -> Optional[str]:
        """users/{userId}/profile/main → son_insight_ay alanını okur."""
        try:
            def _oku():
                doc = self.db.collection("users").document(user_id)\
                    .collection("profile").document("main").get()
                return doc.to_dict().get("son_insight_ay") if doc.exists else None
            return await asyncio.to_thread(_oku)
        except Exception:
            return None

    async def insight_ay_kaydet(self, user_id: str, ay: str) -> None:
        """users/{userId}/profile/main → son_insight_ay alanını günceller."""
        try:
            def _yaz():
                self.db.collection("users").document(user_id)\
                    .collection("profile").document("main")\
                    .set({"son_insight_ay": ay}, merge=True)
            await asyncio.to_thread(_yaz)
        except Exception as e:
            raise RuntimeError(f"Insight ay kaydetme hatası: {e}")

    # ─────────────────────────────────────────────
    # TCMB Cache İşlemleri
    # ─────────────────────────────────────────────

    async def tcmb_cache_oku(self) -> Optional[TCMBData]:
        """
        Firestore'daki TCMB cache verisini okur.
        Koleksiyon: tcmb_cache/latest
        """
        try:
            def _oku():
                doc = self.db.collection("tcmb_cache").document("latest").get()
                return doc.to_dict() if doc.exists else None

            cache_dict = await asyncio.to_thread(_oku)

            if cache_dict is None:
                return None

            return TCMBData(**cache_dict)
        except Exception as e:
            raise RuntimeError(f"TCMB cache okuma hatası: {e}")

    async def tcmb_cache_yaz(self, tcmb: TCMBData) -> None:
        """
        TCMB verisini Firestore cache'e yazar.
        Koleksiyon: tcmb_cache/latest
        """
        try:
            tcmb_dict = tcmb.model_dump()

            def _yaz():
                self.db.collection("tcmb_cache").document("latest").set(tcmb_dict)

            await asyncio.to_thread(_yaz)
        except Exception as e:
            raise RuntimeError(f"TCMB cache yazma hatası: {e}")


# Singleton instance
firebase_service = FirebaseService()
