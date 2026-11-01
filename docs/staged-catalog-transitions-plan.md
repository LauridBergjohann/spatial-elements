# Arbeitsplan: mehrstufige Katalog-Transitions

Stand: 1. November 2026. Status: implementiert und auf Runtime `83ea019` / Demobuild `39337` mit vollständiger 24/24-Produktionsmatrix funktional geprüft. Der nachfolgende Offscreen-Warmup-Stand `960483f` besteht 3/3 gezielte Browserfälle und 978/978 Units; die umfassendere Matrix bleibt auf den genannten Vorgängerstand bezogen. Performance-Abnahme und allgemeine Aktivierung bleiben offen. Der neue Pfad ist weiterhin ausschließlich über `?stagedNavigation=1` eingeschaltet.

**Voraussetzung:** Zuerst den [Umsetzungsplan für das Layoutsystem](layout-system-implementation-plan.md) bis einschließlich Schritt 13 abarbeiten. Er enthält die aktualisierten Layoutvorgaben und hat bei abweichenden Annahmen Vorrang. Die folgenden Layoutschritte 2–4 werden durch dessen Spezifikation, Resolver und Komponentenprüfungen erfüllt; nicht ein zweites Layoutsystem implementieren. Der Nachweis lebender Panels aus dessen Schritt 06 ist Grundlage für Schritt 5 hier. Die folgende Navigation entspricht Schritt 14 des übergeordneten Plans.

Branches in beiden Repos: `feat/staged-catalog-transitions`.
Ausgangspunkt: Framework-Commit `8f647f0`, Examples-Commit `8d3c368`.
Die bisherigen Optimierungen und Messungen stehen in [Navigation responsiveness](navigation-responsiveness.md).

## Ziel und Grenzen

Die erste sichtbare Bewegung soll bei unterstützten Übergängen innerhalb von 100 ms nach dem akzeptierten Klick beginnen. Die Bewegung muss durchgehend flüssig bleiben; ein schneller Start mit anschließendem Ruckeln gilt nicht als Erfolg. Die Zielseite wird erst nach Ende der ersten Bewegung aufgebaut. Vorhandene Geometrie und Panel bleiben während dieser Vorbereitung am Ziel sichtbar. Danach übernimmt die Detailseite ohne Positionssprung und blendet zusätzliche Inhalte ein.

Die Vorwärtswege werden nach Zielkomposition getrennt umgesetzt:

| Quelle | Ziel |
| --- | --- |
| Liste | Detailansicht oben / Hero |
| Liste | gescrollte Detailansicht / kompakter Header |
| Carousel | Detailansicht oben / Hero |
| Carousel | gescrollte Detailansicht / kompakter Header |
| Liste oder Carousel | Detail-3XL / feste Bühne und rechte Content-Pane |

Die ersten vier Wege betreffen XS–2XL. In 3XL bleibt die Hauptgeometrie auf der festen Bühne; ein gespeicherter Scrollzustand verändert den Pane-Inhalt und gegebenenfalls die CTA im Pane-Kopf, nicht das Ziel in einen kompakten Geometrie-Header. Der 3XL-Pfad wird nach den ersten vier Wegen separat ergänzt.

Der Rückweg behält zunächst das bestehende Verfahren. Ebenso bleiben nicht unterstützte Ziele beim bisherigen Ablauf. Native Links, Navigation ohne JavaScript/WebGPU, Tastaturbedienung, History und Reduced Motion müssen weiter funktionieren. Keine Veröffentlichung und kein Versionsbump im Rahmen dieses Plans.

## Verbindliche Architekturregeln

- Detailseite und Transition verwenden dieselbe deklarative Layoutberechnung. Zielrechtecke werden nicht aus einem vorab montierten Ziel-DOM gewonnen. Bestehende Ausgangselemente dürfen vermessen werden.
- Vorab bekannt sind feste Anker, Breiten, Fitbereiche und Höhenobergrenzen, nicht die intrinsische Höhe beliebiger Zielinhalte. Während der Bewegung wird das vorhandene Panel übernommen; zusätzliche Inhalte und zusätzliche Höhe entstehen erst in der Inhaltsphase. Quelle und Ziel dürfen unterschiedliche Panelhöhen haben.
- Der erste Start benötigt weder Routendaten noch vollständige DOM-Kopien. Er darf keine neuen Shader oder GPU-Ressourcen vorbereiten.
- Während der ersten Bewegung bleibt die Ausgangsseite montiert. Nur vorhandene Darstellung, Transformationen und Deckkraft werden verändert. Die vorhandene 3D-Szene wird weiterhin gerendert.
- Netzwerkabrufe dürfen parallel laufen. Modul-Ausführung, Datenverarbeitung und andere Hauptthread-Arbeit sind gesondert zu messen; ein Promise macht diese Arbeit nicht nebenläufig.
- Aufwendiges Mounting, Layout und GPU-Vorbereitung erfolgen nach der ersten Bewegung. Erst wenn die neue Darstellung bereit ist, wird die alte freigegeben.
- Das tatsächliche Panel-DOM wird über einen dauerhaften Svelte-Besitzer in der Shell erhalten. Ein Lease für GPU-Ressourcen oder bloßes Reparenting eines routeeigenen Knotens genügt dafür nicht. Der Inhalts- und Query-Container behält seine Instanz; geänderte Inhalte dürfen später bewusst ersetzt werden.
- Quell-Querybreite und Inhaltslayout bleiben während der Bewegung stabil. Ziel-Querybreite, responsiver Spaltenwechsel und zusätzliche Höhe werden erst in der Inhaltsphase wirksam; sonst könnten echte DOM-Elemente trotz gleicher Identität in jedem Frame neu umbrechen.
- Jede Navigation besitzt einen eindeutigen Besitzer/Generationstoken. Abbruch, Ablösung und Fehler geben Sperren und Ressourcen genau einmal frei; verspätete Ergebnisse dürfen keine neuere Navigation verändern.
- Ein sichtbares, ruhendes Zwischenbild ist zulässig. Ein leerer Frame, Header-Flackern, ein Positionssprung oder das Verdecken eines Fehlers durch unbegrenztes Warten sind es nicht.

## Ablaufmodell

`idle → moving-source → holding-target → binding-destination → revealing → settled`

Das Laden läuft unabhängig davon. Der Route-Commit darf erst nach `moving-source` und nach Verfügbarkeit der Routendaten erfolgen. Bei langsamen Daten verbleibt die Darstellung in `holding-target`. Bei bereits verfügbaren Daten folgt die Bindung direkt auf die Bewegung. Die Rückwärtsnavigation bleibt vorerst beim bisherigen Zustandsmodell.

## Schritte und Commit-Grenzen

Jeder nummerierte Schritt endet mit einem funktionsfähigen, geprüften Stand. Framework und Examples erhalten getrennte Commits, wenn beide betroffen sind; die zugehörigen Commit-IDs werden im Arbeitsprotokoll ergänzt. Der neue Pfad bleibt bis Schritt 9 intern deaktivierbar. Keine halbfertige öffentliche API veröffentlichen.

### 1. Messung und Navigations-Gate absichern

**Commit:** `test: establish staged navigation timing and routing contract`

- Bestehende Browser-Instrumentierung um Klick, erste sichtbare Bewegung, Bewegungsende, Datenbereitschaft, Route-Commit, Bindung und Übernahme ergänzen.
- In einem isolierten Integrationstest nachweisen: frühes Navigationssignal startet die Quelle; ein öffentlicher Cancel/Preload/Goto-Adapter erlaubt genau einen Route-Commit nach dem Bewegungsende, ohne doppelte Navigation oder Deadlock. Frühe und späte Daten sowie supersedierende Navigation abdecken. Der ursprünglich vorgeschlagene `onNavigate`-Promise-Hold wurde in Schritt 14a wegen veralteter Commits bei Supersession verworfen; maßgeblich ist der geprüfte [Gate-Vertrag](design/layout/staged-navigation-gate.md). Der gewöhnliche Pfad sichert seine Quelle seit `039b8e2` [synchron in `onNavigate`](design/layout/synchronous-navigation-capture.md), ohne diesen Commit zu verzögern oder History zu replayen.
- Keine privaten SvelteKit-Interna verwenden. Falls die öffentliche Integration das Gate nicht zuverlässig erlaubt, zuerst den Adapterentwurf korrigieren, bevor die Animation gebaut wird.
- Zeit bis zur tatsächlichen Darstellung über Frame-/Bildprüfungen plausibilisieren; ein gesetztes Datenattribut allein ist kein Beleg für sichtbare Bewegung.

**Prüfung/Abnahme:** Reproduzierbare Baseline mit warmem und kaltem Cache; Gate-Tests für schnelle, verzögerte, fehlgeschlagene und abgebrochene Navigation bestehen. Bisheriges Produktionsverhalten bleibt unverändert.

### 2. Abgenommenen Layoutvertrag für die Navigation prüfen

**Nachweis aus dem Layoutplan; nur bei Ergänzungen eigener Commit:** `docs: refine navigation layout contract`

- Den Vertrag aus dem Layoutplan übernehmen: sieben Viewportlayouts, vier Content-Grids, natürliche Panelhöhen, Hero/Dock und feste 3XL-Bühne mit Dokument-Scroll. Bereits entschiedene Produktfragen nicht erneut aufmachen.
- Für die Navigation nur noch prüfen, welche festen Anker/Maximalhöhen vorab bekannt sind und welche inhaltsabhängigen Maße ausdrücklich erst nach der Bewegung entstehen.
- Festlegen, welche Eingaben vor der Navigation verfügbar sind und wie das Ziel Hero/Dock erkannt wird. Unbekannte History-/Fragmentziele dürfen nicht anhand einer Vermutung animiert werden.
- Stabile Viewport-Maße bei ausblendender mobiler Adresszeile sowie Verhalten bei echter Größen-/Orientierungsänderung festlegen.

**Prüfung/Abnahme:** Beispielspezifikationen für Desktop, Tablet, Mobil und 3XL; jeder für die erste Bewegung benötigte Zielanker ist aus bekannten Eingaben berechenbar. Inhaltsabhängige Zielhöhen sind separat beschrieben und keine versteckte Voraussetzung des frühen Starts.

### 3. Gemeinsamen Layoutresolver für Transition-Ziele verwenden

**Nachweis aus dem Layoutplan; nur bei Ergänzungen eigener Commit:** `feat(core): derive transition targets from shared layouts`

- Reine Layoutfunktion mit typisierten Eingaben und festen Bereichen für Hero, Panel, Media-Rail, Tabs, Dock und 3XL-Bühne für die Transition verwenden. Keine DOM- oder GPU-Abhängigkeit.
- Hier den bereits implementierten Resolver des Layoutplans verwenden und nur noch fehlende Navigationseingaben ergänzen. Natürliche Höhe als solche behandeln, keine scheinbar exakten Rechtecke beliebiger Zielinhalte erfinden.
- Modell-Framing gesondert berücksichtigen: Zielrechteck allein bestimmt noch nicht Kamerapose und sichtbare Modellgröße. Bestehende Modellgrenzen und gemeinsame Framing-Regeln verwenden.
- Transition-Ziele zunächst diagnostisch mit den fertig integrierten Layouts vergleichen, ohne den neuen Navigationspfad zu aktivieren.

**Prüfung/Abnahme:** Unit-Tests für Breakpoint-Grenzen, schmale/kurze Viewports, Safe Areas und ungültige Eingaben. Alle Rechtecke bleiben endlich und erfüllen die vereinbarten Abstands-/Überlaufregeln.

### 4. Gemeinsamen Layoutvertrag bei der Detailübergabe verifizieren

**Nachweis aus dem Layoutplan; nur bei Ergänzungen eigener Commit:** `test: verify shared layout at detail handoff`

- Die bereits auf den Layoutvertrag umgestellten SSR-/Client-Komponenten für die Übergabe prüfen. Responsive CSS und Resolver verwenden dieselben Tokens/Formeln; keine unabhängige zweite Sammlung von Konstanten ergänzen.
- Panel-Inhalte und Überlauf nach den vereinbarten Regeln behandeln. Native Darstellung bleibt vollständig nutzbar.
- DOM-Messungen für die Überprüfung dürfen bleiben, nicht als Voraussetzung zur Berechnung der Vorwärts-Zielposition.

**Prüfung/Abnahme:** Bestehende Nachweise aus dem Layoutplan verwenden. Browser vergleicht feste berechnete Anker/Rechtecke mit der Darstellung (maximal 1 CSS-Pixel Rundungsabweichung); natürliche Höhe gegen ihre Flow-/Maximalhöhenregel prüfen. Screenshot-Prüfungen für Hero/Dock/3XL, Mobil/Desktop, lange Titel und unterschiedliche Inhaltsmengen. Direkteinstieg, SSR und deaktiviertes JavaScript prüfen. Bestehende Transition arbeitet weiterhin.

### 5. Vorhandene Darstellung als unabhängigen Transition-Teilnehmer halten

**Commit:** `refactor(core): retain source presentation across destination binding`

- In `CatalogTransition` und `StageExperience` Besitz und Lebensdauer von ausgewählter Geometrie, Panel und bestehendem Inhalt vom Seiten-Binding trennen.
- Ausgangsdarstellung für die Bewegung weiterverwenden; umfangreiche Style-Kopien aus dem frühen Pfad entfernen. Lebenden Panel-Host aus dem Layoutplan anbinden, inklusive Instanz-/Query-Container-Identität, Zustandsbesitz und Fokusvertrag.
- Verhindern, dass `releasePage`/`updatePage` die gehaltene Darstellung vorzeitig freigibt. Bestehende und neue Szene dürfen während der Übergabe nicht doppelt sichtbar sein.
- Header-Kontinuität sowie Sensor-/Hover-Einflüsse während der Navigation eindeutig regeln.

**Prüfung/Abnahme:** Unit-Tests für Besitz, Freigabe und veraltete Async-Ergebnisse. Browser hält die Zielbindung künstlich an: Quelle bleibt sichtbar, keine doppelten Modelle, kein Header-Flackern. Nach Abbruch/Teardown keine verbleibenden Overlays oder Interaktionssperren.

### 6. Erste vertikale Integration: Liste → Hero

**Commit:** `feat: start list to hero motion before route commit`

- Frühen Start und Route-Gate aus Schritt 1 in `ScrollNavigationBridge`/`Stage` integrieren; nur unterstützte, akzeptierte Navigation behandeln, keine Modifier-Klicks oder externen Links übernehmen.
- Vorhandene Karte unmittelbar zum berechneten Hero-Ziel bewegen, übrige Inhalte ausblenden. Währenddessen kein Ziel-Mounting und keine neue GPU-Vorbereitung.
- Nach Bewegungsende Zielseite binden; gehaltene Darstellung während der Vorbereitung unverändert zeigen. Bei fertigem ersten Zielframe nahtlos übernehmen und Ergänzungen einblenden.
- Kartentext zunächst beibehalten. Vollständigen Summary-Inhalt und daraus entstehende zusätzliche Höhe erst in der Inhaltsphase herstellen; der feste Modellanker darf dadurch nicht springen.
- Bestehenden Ladeindikator für diesen Pfad ersetzen; für nicht unterstützte Navigation beibehalten. Reduced Motion ohne künstliche Animationswartezeit behandeln.

**Prüfung/Abnahme:** Wurm Liste → Hero bei warmem und kaltem Cache, schnellem und verzögertem Netz, Maus und Tastatur. Gate beweist keinen Route-Commit während der Bewegung. Abbruch, Doppelklick, Browser-Zurück und Ladefehler funktionieren. Erst bei bestandenem visuellen und zeitlichen Gate auf weitere Varianten erweitern.

### 7. Liste → kompakter Detailheader

**Commit:** `feat: stage list to dock transitions`

- Dock-Ziel aus dem bekannten Navigationskontext und Layoutvertrag bestimmen. Modell, Panel und gemeinsame Texte in den kompakten Zustand überführen.
- Nach Bewegungsende tatsächliche Scroll-/Fragmentposition wiederherstellen und Ziel binden, ohne sichtbare Scrollkorrektur der gehaltenen Darstellung.
- Bei unbestimmbarem oder abweichendem Ziel bewusst den bestehenden Pfad wählen; keine sichtbare Korrekturbewegung als Normalfall.

**Prüfung/Abnahme:** Bekannte Abschnittsziele, gespeicherte Scrollpositionen und History getrennt prüfen. Dock-Rechtecke stimmen vor/nach Übergabe überein; Fokus und Hash bleiben korrekt. Header-Verhalten entspricht dem jeweiligen Zielzustand.

### 8. Carousel → Hero und Dock

**Commit:** `feat: stage carousel to detail transitions`

- Ausgewähltes Modell und zugehöriges Panel aus der gemeinsamen Carousel-Szene übernehmen. Ausgangspose einschließlich Kameraperspektive berücksichtigen.
- Nachbarelemente und Carousel-Bedienung ausblenden, ohne die aktive Geometrie springen zu lassen. Hero- und Dock-Ziele verwenden dieselben Übergabewege wie die Liste.
- Carousel-Auswahl und Rückkehrzustand erhalten; Maus-/Lagesensoreffekte dürfen die laufende Navigation nicht überlagern.

**Prüfung/Abnahme:** Beide Ziele bei unterschiedlichen Carousel-Auswahlen, aktiver Sensorpose und nach horizontalem Scrollen. Keine Kamerasprünge, doppelten Panels oder Rückkehr-Regressionsfehler. Bestehende Carousel-Paint-Tests ergänzen, nicht durch schwächere Prüfungen ersetzen.

### 9. Performance-Gate, Fehlerfälle und Aktivierung

Vor diesem Gate den zusätzlichen 3XL-Pfad aus Schritt 14e des Layoutplans implementieren und separat prüfen: feste Bühne, integriertes Panel, Dokument-Scroll und persistente Pane-Position. Die vier Hero-/Dock-Pfade nicht ungeprüft auf 3XL übertragen.

**Commit:** `perf: enable validated staged forward navigation`

- Alle Hero-/Dock-Wege und beide Quellen zum 3XL-Ziel im Produktionsbuild messen; echte Mobilgeräte für die dort verfügbaren Layouts einbeziehen, warme/kalte Daten und Module getrennt ausweisen.
- SvelteKit-Ladepfad auf Long Tasks durch Modul-Ausführung und Datenverarbeitung prüfen. Vorladen gezielt verbessern oder Arbeit verschieben, falls diese die Bewegung stört. Nicht erst nach Bewegungsende pauschal alle Downloads starten.
- Ressourcenverlust, Resize/Orientierungswechsel, langsame/fehlgeschlagene Requests und konkurrierende Navigation aufräumen. Begrenzte Warte-/Fehlerstrategie mit sichtbarem Ausweg festlegen und testen.
- Neuen Pfad für validierte Vorwärtsfälle aktivieren, temporäre Instrumentierung auf Test-/Diagnosebetrieb beschränken. Rückweg und nicht unterstützte Fälle behalten ihren bisherigen Pfad.
- API-/Layout-Dokumentation und Changeset an den finalen Umfang anpassen; Examples mit passendem Framework-Stand prüfen.

**Prüfung/Abnahme:** Gesamte relevante Regression-Suite und untenstehende Performance-Kriterien bestehen. Keine unbedingte Ruckelfreiheitsbehauptung aus ausschließlich lokalen Desktop-Messungen ableiten.

## Mess- und Teststrategie

- Pro repräsentativem Weg mindestens 20 Wiederholungen im Produktionsbuild; Median, p95 und schlechtesten Wert für Klick → erste Bewegung sowie Gesamtdauer berichten. Warme und kalte Läufe getrennt halten.
- Ziel: p95 der ersten sichtbaren Bewegung unter 100 ms auf den vereinbarten Referenzgeräten. Ausreißer einschließlich Hintergrundlast dokumentieren, nicht wegfiltern.
- Frameintervalle gegen die gemessene Bildwiederholrate auswerten. Wiederholte Intervalle über zwei Framebudgets und Long Tasks während Bewegung oder Einblendung blockieren die Freigabe und müssen untersucht werden. RAF-Daten durch visuelle Aufzeichnung ergänzen; sie beweisen allein keine GPU-Präsentation.
- Keine Ziel-Mounts, umfassenden Snapshot-Kopien oder neuen Pipeline-Kompilierungen während `moving-source`. Dies mit Instrumentierung prüfen, nicht nur anhand der Gesamtdauer vermuten.
- Bei künstlich verzögerter Zielbindung muss das Zwischenbild unverändert sichtbar bleiben. Vor/nach Übernahme maximal 1 CSS-Pixel Abweichung fester Anker; Modell-Framing und Pose zusätzlich visuell vergleichen. Die bewusst spätere Änderung der Panelhöhe gesondert auf ruhigen Inhaltsaufbau prüfen.
- Bestehende Tests für Header-Kontinuität, Carousel-Paint, Navigation-Abbruch, History, Fokus, Reduced Motion und Fallbacks weiterführen. Die bisherige Prüfung „Feedback sichtbar bis Animation“ für den neuen Pfad gezielt durch „frühe echte Bewegung und gehaltene Darstellung“ ergänzen.
- Pro Commit gezielte Unit-/Browserprüfungen; bei Adapter-/Typänderungen `npm.cmd run check`, bei finaler Integration zusätzlich `npm.cmd test` und Produktionsbuilds beider Repos. Keine unnötigen Tests für reine Dokumentationsschritte.

## Arbeitsprotokoll

Bei Abschluss jedes Schritts ergänzen: Framework-/Examples-Commit, ausgeführte Prüfungen, Messartefakte, offene Einschränkungen und gegebenenfalls geänderte Entscheidungen. Ein Schritt ist erst abgeschlossen, wenn sein Abnahmekriterium erfüllt ist.

| Schritt | Status | Commits / Nachweis |
| --- | --- | --- |
| 1 Messung/Gate | abgeschlossen | Öffentliche Kit-Integration und Cancel/Preload/Goto-Gate in `9a85db4`; zehn Routing-, vier DOM-Browserfälle und 39 Unit-Fälle. |
| 2–4 Layoutgrundlage | abgeschlossen | Durch Schritte 01–12 des [Layoutplans](layout-system-implementation-plan.md) ersetzt: kanonischer Resolver, Grid/Sections, Karten, Summary, Dock, 3XL und Carousel. Dort stehen die einzelnen Commits und Produktionsnachweise. |
| 5 Persistente Darstellung | abgeschlossen | `44a99fd`: echte Card-/Summary-Komponenten, Freeze/Hold/Adopt/Restore; 18 Ownership-/DOM-Browserfälle und sieben Carousel-Regressionsfälle. |
| 6–8 Vorwärtsbewegung | funktional geprüft auf `83ea019` | Neuer vollständiger gemeinsamer Lauf **24/24** auf Demobuild `39337` / Runtime `83ea019` (Run `98004`, Exit 0), Artefakte `.artifacts/staged-production-39337-83ea019`. Historischer vorheriger Stand: Vollständige **24/24-Produktionsmatrix** auf Demobuild `10039` / Runtime `8873f41`, Fixture `6a2ed1f`, Run `27302`, Exit 0. Sie prüft Liste/Carousel → Hero/Dock/3XL, langsames Laden, Reduced Motion, Fehler, Abbrüche, Back, echte Summaryidentität und beide Scene-Cache-Hit-Pfade; zwölf direkte Projektionsvergleiche halten höchstens 1 CSS-Pixel Handoff-Abweichung. Artefakte `.artifacts/staged-production-10039-8873f41`. Der gemeinsame Stand enthält die Paint-/Fokus-/Readiness- und StageDisplay-Korrekturen. Historische 22/22 auf 54041 sowie 19/24 auf 2616 mit fünf korrigierten Nachtests und Escape auf 5312 bleiben getrennt dokumentiert im [Layoutplan](layout-system-implementation-plan.md). |
| 9 Performance/Aktivierung | offen; weiterhin Opt-in | [Messprotokoll](design/layout/staged-performance.md): Die ursprüngliche 80er-Matrix und alle Folgeproben bleiben erhalten. Neueste isolierte, unprofilierte v2-synthetic-n1-Kohorte auf Demobuild `10026` / Runtime `039b8e2`, Run `59216`, Exit 0: vier Startlatenzfälle und alle zwölf Startgates unter 100ms; DOM 88,2/88,6ms (Liste kalt/warm), 81,5/57,7ms (Carousel kalt/warm). GPU-Erzeugungen von Klick bis Bewegungsende sowie während Reveal überall 0, Validierungsfehler leer. Drei Kalibrierungen sind instabil. Warme Liste besteht die rohen Framegates, ist wegen n1/instabiler Kalibrierung nicht abnahmefähig; warmes Carousel ist stabil kalibriert, hat aber 49,9ms Moving-/50,0ms Reveal-Lücken. Kaltes Carousel hat 50,0ms Moving, kalte Liste 50,1/50,0ms Reveal plus 39,3ms Bewegungsanteil einer Grenzlücke. Keine verworfenen Samples, geänderten Rohgates oder isolierte Verbesserungskausalität. StageDisplay ist enthalten, sein eigener Pacingbeitrag damit nicht bewiesen. Wiederholungs-/Geräteabnahme und allgemeine Aktivierung bleiben offen. |

Der frühere vollständige Framework-Integrationsnachweis gilt für `8873f41`: **914/914 Units in 116 Dateien**, Workspace-Typechecks **0/0**, erfolgreiche Paket-/Demo-Builds und vollständige 24er-Produktionsmatrix. Logs: `.artifacts/layout-display-clear-units.log`, `layout-display-clear-check.log`, `layout-display-clear-package-build.log`, `layout-display-clear-resize-demo-build.log`. Examples `6938b45` / Build `44157` hatte im privaten Run `6701` 4/6 Erfolge; dieser Fehlstand bleibt erhalten. Nach Tooltip-Selector `d557914` und synchronem Capture `039b8e2` bestehen dieselben sechs gewöhnlichen Carousel-/Headerfälle auf Examples-Build `20223` mit **6/6** (Run `16117`). Die zwei zusätzlichen FastBack-Fälle aus Examples `be739a1` stellen URL, acht Einträge, Fokus und Historylänge korrekt her, scheiterten auf `039b8e2` aber an einem separaten nullgebundenen Tabs-Messcallback. Dessen Fix `83ea019` besteht 7/7 Units und Sveltecheck 0/0. Auf Examples-Build `82285` / Framework-Checkpoint `52c342e` bestehen nun beide FastBack-Nachtests vollständig (Run `89730`, Exit 0): normale/reduzierte Bewegung, alle Back/Forward-State-Vergleiche, konstante Historylänge und leere pageerrors. Artefakte privat `.artifacts/layout-regression-82285-83ea019-fast-back`; die vorherigen Fehltraces bleiben erhalten. Fullscreen-Capture-Reihenfolge `6e79c9a` besteht 28/28 gezielte Units und 2/2 Browserfälle auf Demo `39337` (Run `3553`, Exit 0): Fallback-Pose vor Bindung/Bewegung an vier Punkten innerhalb 1 CSS-Pixel, nativer Exit/Resize und erneute Navigation bedienbar. Artefakte `.artifacts/fullscreen-navigation-39337-83ea019`; ein exakter maximaler Pixelwert ist mangels persistiertem inline JSON nicht nachträglich ablesbar. Der aktuelle Framework-Checkpoint `52c342e` mit beiden Folgekorrekturen besteht **936/936 Units in 119 Dateien** (Run `46764`, Exit 0) und alle Workspace-Typechecks mit **0/0** (Run `97989`, Exit 0); Paketbuild `67527`, Demobuild `39337` und Examples-Build `82285` sind erfolgreich. Auf `39337` / Runtime `83ea019` besteht nun auch die neue vollständige Produktionsmatrix **24/24 gemeinsam** (Run `98004`, Exit 0), Artefakte `.artifacts/staged-production-39337-83ea019`. Isolierter Tarball-Consumer `76173`, Exit 0: 460 Core-/118 Svelte-Allowlistdateien, unabhängige Installation in `spatial-elements-consumer-be4kMc`, automatisch installiertes Three-Peer, Coreimport ohne DOM/GPU, Sveltecheck 0/0 und SSR-Produktionsbuild. Offline npm/Workspacecache nach archiviertem Globalcache-EPERM (`94814`) und abgebrochenem Netzwerk-EACCES-Retry (`60801`); Erfolgslog `.artifacts/layout-history-fixes-package-consumer-offline.log`. Geprüfte Bytes: Svelte-Runtime `83ea019`/Core `8873f41`, Quellencheckpoint `52c342e`, keine spätere Warmup-WIP. Release-Metadaten, sechs Release-Tests, Boundaries, Layoutgenerator und Wiki 13/31 ebenfalls grün (`92806`, Exit 0). Keine dieser Folgekorrekturen wird rückwirkend in den historischen Vollnachweis eingerechnet. Nachfolgender Warmup-Commit `60deaac`: 76 gezielte Units und Typechecks grün, Paketbuild `23283` erfolgreich, Demobuild `27554` noch laufend und keine Browserabnahme. Die genannten Vollnachweise gelten ausschließlich für den vorherigen `83ea019`-Checkpoint, nicht für diese neue Runtime.

- `2218421`: [Paint-Gelegenheit vor Ownership-Cleanup](design/layout/staged-cleanup-paint.md), zwei echte Summary-Browserfälle auf Build `70245` / `8eaf276` grün; Reveal-Endmarker und Rohgates unverändert.
- `8eaf276`: [Aktivierungsfokus-Koaleszierung](design/layout/catalog-activation-focus.md), sechs separate Produktionsbrowserfälle auf demselben Build grün, einschließlich Navigation ohne Opt-in und DOM-Veto.
- `be72259`: [Readiness-No-op](design/layout/catalog-preparation-notifications.md), profiliert 0 Pre-Adapter-Submits auf Build `36109`; separat vier vollständige unprofilierte n1-Samples. Keines dieser Ergebnisse liefert p95-Abnahme.
- `8873f41`: [StageDisplay-Pixelproof](design/layout/stage-display-clear.md) auf Build `10039` / Fixture `6a2ed1f`: 24 exakte lineare/Canvas-Vergleiche, 0 GPU-Validierungsfehler; Standardfälle 4→2 Submits, Fallbacks 4→4. Nachweis dokumentiert in `13be2b4`, eine spätere unprofilierte n1-Kohorte enthält den Pfad, weist aber keine isolierte Pacingwirkung dieser Änderung nach.

Die [Cleanup-/Zoom-Auswertung](../.artifacts/staged-gpu-trace-36109-be72259-carousel-cold/cleanup-zoom-audit.md) dokumentiert Anschlusslast außerhalb des Reveal: profiliert 69,006ms Cleanup und später 173,503ms optionale Zoom-Vorbereitung. Sie wird nicht als eingesparte Animationsarbeit umetikettiert.

Neuester vollständiger Funktionscheckpoint: **24/24 gemeinsam** auf Demo
`91647` / Runtime `960483f` (Run `17707`, Exit 0), Artefakte
`.artifacts/staged-production-91647-960483f`. Der Offscreen-Scroll-Warmup ist
enthalten, der folgende optionale CatalogWarmOutputContext noch nicht.

Neuester Messcheckpoint: Demo `11873` / Runtime `960483f`, Run `76630`, Exit 0,
vier diagnostische n1-Startlatenzfälle. DOM-Reaktion 64,7/41,5ms für Liste kalt/warm
und 55,5/38,4ms für Carousel kalt/warm; alle zwölf Startgates erfüllt. Die rohen
Framegates bleiben offen (unter anderem 66,6ms Reveal bei kalter Liste und
50,0ms Moving bei kaltem Carousel), zwei Kalibrierungen instabil. Vollständige
Abgrenzung im [Messprotokoll](design/layout/staged-performance.md).

Nächste Abfolge: die verbleibenden Framegates untersuchen und spätere Runtimeänderungen erneut gezielt prüfen; der aktuelle Software-/Paketnachweis zertifiziert keine nachfolgenden Experimente. Keine allgemeine Aktivierung aus n1-Werten, Profilertimings, Pixelparität oder ausschließlich funktional grünen Tests ableiten.
