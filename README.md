# GLF TeKnoService — PWA (FINAL)
- Firestore integrato (auth + salvataggio entries)
- Minuti in step 00/30
- Calendario & Elenco responsive
- PDF con fascia rossa #ff0a09 e logo centrato, NOTE non attaccata
- Service Worker incluso (cache statica, sicuro con Firebase)

## Firestore Regole
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
