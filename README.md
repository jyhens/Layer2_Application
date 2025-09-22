# LeavePlanner – Urlaubsanträge mit Konfliktprüfung

## Projektziel: 
C# WebAPI mit optionaler UI zu entwickeln, die Mitarbeitenden erlaubt, Urlaubsanträge für einzelne Arbeitstage zu stellen. Die API prüft automatisch, ob an diesem Tag Konflikte mit anderen Teammitgliedern in denselben Projekten entstehen, und liefert entsprechende Konflikthinweise. Der Genehmigungsprozess berücksichtigt unterschiedliche Rollen (Employee, Approver, Admin) und Benachrichtigungen informieren über Statusänderungen.

## Kurzarchitektur

### Datenmodell
Die Anwendung basiert auf Entity Framework Core mit SQLite als persistenter Datenbank (`leaveplanner.db`, Connection String in `appsettings.json`).  
Die zentralen Entitäten sind:

- **Employee** – Mitarbeitende mit `Id`, `Name`, `JobTitle` und `Role` (Enum: `Employee`, `Approver`, `Admin`).  
- **Customer** – Kunde, dem Projekte zugeordnet werden können.  
- **Project** – Projekt mit `Id`, `Name`, `StartDate`, optionalem `EndDate` und Referenz zu einem Customer.  
- **ProjectAssignment** – Zuordnung Mitarbeitende ↔ Projekt. Dient zur sauberen Beziehung und ermöglicht Konfliktprüfungen („Gehört Mitarbeiter X am Tag Y zu Projekt Z?“).  
- **LeaveRequest** – Urlaubsantrag für **einen Arbeitstag** (`DateOnly`).  
- **LeaveStatus** – Status des Antrags (`Requested`, `Approved`, `Rejected`, `Cancelled`).  

Die zentrale Klasse **LeavePlannerDbContext** bündelt die DbSets, Relationen und Constraints (z. B. Unique-Index für *ein Antrag pro Mitarbeiter+Tag*, Validierung Projekt-Zuordnung).


### API-Controller
Die REST-API besteht aus folgenden Controllern (alle unter `/api/...`):

- **EmployeesController**
  - CRUD für Mitarbeitende (`GET`, `GET/{id}`, `POST`, `PUT`, `DELETE`).  
  - Validierung: `Name` ist Pflicht.  
  - Rollenlogik: Standard ist `Employee`. Rollenänderung über `PUT /api/employees/{id}/role` (nur Admin).  

- **CustomersController**
  - CRUD für Kunden.  
  - Validierung: `Name` ist Pflicht.  

- **ProjectsController**
  - CRUD für Projekte.  
  - Validierung: `CustomerId` muss existieren, `EndDate >= StartDate` (oder `null`).  
  - Projektzuordnungen:  
    - `POST /api/projects/{projectId}/assignments` → Mitarbeitende zuordnen.  
    - `GET /api/projects/{projectId}/assignments` → Liste Mitarbeitende im Projekt.  
    - `DELETE /api/projects/{projectId}/assignments/{employeeId}` → Zuordnung entfernen.  
    - Validierung: Keine Doppelzuordnung, sonst `409 Conflict`.  

- **LeavesController**
  - `GET /api/leaves?employeeId=&date=` – Liste/Filter.  
  - `GET /api/leaves/{id}` – Einzelner Antrag.  
  - `POST /api/leaves` – Beantragen (Status = Requested).  
    - Validierung: Employee existiert, pro (Employee, Date) nur ein Antrag → sonst `409`.  
  - `POST /api/leaves/{id}/approve` – Genehmigen.  
  - `POST /api/leaves/{id}/reject` – Ablehnen (mit optionalem Kommentar).  
  - Rollen & Workflow:  
    - Header `X-Employee-Id` erforderlich (GUID eines existierenden Mitarbeiters).  
    - Nur `Approver` oder `Admin` dürfen genehmigen/ablehnen.  
    - Eigene Anträge dürfen nicht genehmigt/abgelehnt werden.  
    - Bei Entscheidung werden `DecisionByEmployeeId`, `DecisionAt (UTC)` und optional `DecisionComment` gesetzt.  
  - **Konflikthinweise (ComputeConflictHints):**  
    - Keine Projektzuordnung → keine Konflikte.  
    - Beantragung: Konflikte nur mit **Approved** Anträgen anderer Teammitglieder.  
    - Genehmigung: Konflikte mit **Approved + Requested** anderer Teammitglieder.  
    - Konflikte werden nach Projekt gruppiert (`projectId`, `projectName`, betroffene Mitarbeitende).  
    - Ein Kollege in mehreren Projekten am selben Tag → taucht in allen betroffenen Projekten auf.  

- **NotificationsController**
  - `GET /api/notifications?onlyUnread=` – Liste der Benachrichtigungen für den aktuellen User (`X-Employee-Id`).  
    - Zugriff: Nur eigene Notifications, außer Admins → dürfen alle abrufen.  
    - Sortierung: Neueste zuerst (clientseitig, da SQLite kein ORDER BY auf `DateTimeOffset` unterstützt).  
  - `POST /api/notifications/mark-read` – Markiert übergebene IDs als gelesen.  
    - Zugriff: Nur eigene Notifications, außer Admins → dürfen beliebige markieren.  
  - Ereignisse: Notifications werden beim Beantragen (Submitted), Genehmigen (Approved), Ablehnen (Rejected) erzeugt.  

## Annahmen

- **Ein Antrag = ein Arbeitstag**  
  Jeder Urlaubsantrag bezieht sich genau auf **einen Kalendertag** (`DateOnly`). Mehrtägige Anträge sind bewusst nicht Teil des aktuellen Scopes.
- **Projektzuordnung bestimmt Konfliktprüfung**  
  Konflikte werden nur geprüft, wenn ein Mitarbeiter am gewählten Tag **zu mindestens einem Projekt zugeordnet** ist.  
  → Keine Projektzuordnung = keine Konflikte.
- **Konfliktlogik**  
  - **Beantragung:** Konfliktprüfung nur gegen **Approved** Anträge anderer Teammitglieder.  
  - **Genehmigung:** Konfliktprüfung gegen **Approved + Requested** Anträge anderer Teammitglieder.  
  - Konflikte werden nach Projekt gruppiert. Ein Kollege in mehreren gemeinsamen Projekten erscheint mehrfach.
- **Rollenmodell**  
  - `Employee` kann Anträge stellen.  
  - `Approver` und `Admin` dürfen Anträge genehmigen/ablehnen.  
  - Eigene Anträge dürfen nicht genehmigt/abgelehnt werden.  
  - Es muss immer mindestens ein `Admin` existieren (Löschen/Demoten des letzten Admins ist blockiert).
- **Validierungen & Constraints**  
  - Pro (Employee, Date) darf es nur **einen LeaveRequest** geben (DB-Unique-Index).  
  - `Name`-Felder (Employee, Customer, Project) sind Pflicht und haben eine Maximal­länge von 200 Zeichen.  
  - Projekt-Enddatum (`EndDate`) muss `>= StartDate` oder `null` sein.
- **Benachrichtigungen**  
  - Entstehen bei Beantragung (`Submitted`), Genehmigung (`Approved`), Ablehnung (`Rejected`).  
  - Zugriff nur auf eigene Notifications, außer Admins.  
  - Sortierung erfolgt clientseitig, um SQLite-Limitierungen zu umgehen.

## Fehlercodes & Standardtexte

Die API antwortet bei Fehlern mit kurzen, UI-tauglichen Texten 

**400 Bad Request** Validierung/Preconditions verletzt.  
- **Beispiele:**  
  - `Name is required.`  
  - `EmployeeId is required.`  
  - `Customer does not exist.`  
  - `EndDate must be null or >= StartDate.`

**401 Unauthorized** Erforderlicher Header fehlt/ungültig (nur bei Approve/Reject, Notifications, Role-Update).  
- **Beispiel:**  
  - `Provide X-Employee-Id header.`

**403 Forbidden** Berechtigung fehlt oder Self-Action blockiert.  
- **Beispiele:**  
  - `Approver or Admin role required.`  
  - `Admin role required to change roles.`  
  - `Only Admin may query another user's notifications.`  
  - `You cannot approve your own leave.`  
  - `You cannot reject your own leave.`

**404 Not Found** Ressource existiert nicht.  
- **Beispiele:**  
  - `Employee not found.`  
  - `Project not found.`  
  - `Leave not found.`  
  - `Assignment not found.`

**409 Conflict**Zustand-Konflikt (Duplikat/Status/Business-Rule).  
- **Beispiele:**  
  - `Leave request for this employee and date already exists.`  
  - `Employee already assigned to this project.`  
  - `Cannot demote the last remaining Admin.`  
  - `Cannot delete the last remaining Admin.`  
  - `Leave is already approved.`  
  - `Leave is already rejected.`  
  - `Approved leave cannot be rejected.`  
  - `Leave has been rejected and cannot be approved.`

**500 Internal Server Error** Unerwarteter technischer Fehler (z. B. DB).  
- Details in den Serverlogs.

**Hinweise allgemein**  
- `X-Employee-Id: <GUID>` ist nur für Approve/Reject, Notifications (GET/mark-read) und Role-Update nötig.  
- Fehlermeldungen kurz und präzise (für Toasts).  


## Lokal starten – Backend

### Voraussetzungen
- **.NET 8 SDK** 
- **SQLite** (Datenbank-Datei wird automatisch erstellt)

### Konfiguration (appsettings)
Die Umgebung wird über `ASPNETCORE_ENVIRONMENT` bestimmt (`Development` | `Production`).  
Die *environment*-Datei überlagert `appsettings.json`.

### Start im Entwicklungsmodus
- cd LeavePlanner.Api
- dotnet run --launch-profile "DevHttp"

Verhalten
- Datenbank wird automatisch erstellt/migriert (SQLite).
- Seeding legt Beispiel-Daten an.
- Swagger: http://localhost:5268/swagger
- Healthchecks:
  - GET /debug/env  → Umgebungsname
  - GET /health/db  → DB-Verbindung & Migrationsstatus

### Start im Production-Modus (lokal)
- set ASPNETCORE_ENVIRONMENT=Production
- dotnet run --launch-profile "ProdHttp"

Verhalten 
- Swagger & Seeding: deaktiviert
- HTTPS/HSTS aktiviert

## Lokal starten – Frontend

### Voraussetzungen
- Node.js ≥ 18
- Backend läuft 

**Konfiguration**
VITE_API_BASE_URL=http://localhost:5268

### Start
- cd leave-planner-web
- npm install
- npm run dev -> öffnet i. d. R. http://localhost:5173

## Lokal starten – Tests
- Konflikt bei Approved Urlaub von Teammitgliedern.
- Kein Konflikt, wenn Team frei ist.
- Beim Approve zählen auch Requested Urlaubstage anderer.
- Mitarbeitende ohne Projektzuordnung erzeugen keine Konflikte.
- Doppelte Anträge (selber Mitarbeiter, selbes Datum) liefern 409 Conflict.

### Voraussetzungen
- Projekt: LeavePlanner.Api.Tests (xUnit, FluentAssertions)
- Abhängig von: LeavePlanner.Api (ProjectReference)
- nutzt xunit, FluentAssertions, Microsoft.AspNetCore.Mvc.Testing (8.*), Microsoft.EntityFrameworkCore.Sqlite 

### Test starten
dotnet test

## Rollen & UI-Abläufe 
Voraussetzung: UI sendet `X-Employee-Id` (GUID).  

### Employee
- **Urlaub beantragen** → `POST /api/leaves`
- Konflikthinweis nach Beantragung: nur **Approved** anderer im gleichen Projekt
- Eigene Anträge ansehen (Status, Entscheidungsinfos)
- Urlaub Notifications lesen / als gelesen markieren

### Approver (zusätzlich zu Employee)
- Genehmigen/Ablehnen fremder Anträge (kein Self-Approve/Reject)
- Konflikthinweis beim Genehmigen: **Approved + Requested** anderer
- Reject mit optionalem Kommentar

### Admin (zusätzlich zu Approver)
- Mitarbeitende anlegen/bearbeiten/löschen; Rollen ändern
- CRUD Kunden/Projekte ; Assignments pflegen 


