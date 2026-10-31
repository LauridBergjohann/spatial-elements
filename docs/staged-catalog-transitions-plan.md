# Arbeitsplan: mehrstufige Katalog-Transitions

Stand: 1. November 2026. Status: implementiert und bis `ebeed3e` funktional geprüft; weitere Korrekturen sind unitgeprüft und warten auf ihren Produktionsbrowsernachweis. Performance-Abnahme und allgemeine Aktivierung bleiben offen. Der neue Pfad ist weiterhin ausschließlich über `?stagedNavigation=1` eingeschaltet.

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
- In einem isolierten Integrationstest nachweisen: frühes Navigationssignal startet die Quelle; das spätere `onNavigate` hält den Commit bis zum Bewegungsende zurück, ohne doppelte Navigation oder Deadlock. Frühe und späte Daten sowie supersedierende Navigation abdecken.
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
| 6–8 Vorwärtsbewegung | bis `ebeed3e` funktional geprüft; Folgekorrekturen ausstehend | `3453218`, `7e26ede` bilden die Grundlage aus vorbereiteten GPU-Pässen, Hero-/Dock-Zielen, Sensorpause und abbrechbarem Capture-Besitz. Die vollständige 22/22-Produktionsmatrix auf 54041 / `362b98a` prüft Liste/Carousel → Hero/Dock/3XL, langsames Laden, Reduced Motion, Fehler, Abbrüche und Back. Auf 2616 / `d92a3b9` bestand die um zwei Cache-Hit-Fälle erweiterte Matrix zunächst 19/24; fünf Carousel-Einstiege lehnten wegen optionaler Ground-Vorbereitung die Capture ab. Nach `ebeed3e` bestanden diese fünf Fälle und zusätzlich Escape auf Build 5312 mit 6/6. Damit sind 24 Fälle über 19 + 5 Nachtests sowie Escape abgedeckt; keine zweite vollständige 24er-Serie behauptet. Zwölf Projektionsvergleiche prüfen höchstens 1 CSS-Pixel Handoff-Abweichung. Die neuen Folgekorrekturen `2218421`/`8eaf276` warten trotz gezielter grüner Units noch auf ihren gemeinsamen Browsernachweis. Details und frühere Artefakte im Arbeitsprotokoll des [Layoutplans](layout-system-implementation-plan.md). |
| 9 Performance/Aktivierung | offen; weiterhin Opt-in | [Messprotokoll](design/layout/staged-performance.md): Die erste 80er-Hero-Matrix bleibt unverändert dokumentiert (je 20 kalt/warm pro Liste/Carousel): DOM-p95 90,6/76,8ms und 118,7/96,3ms. Kaltes Carousel verfehlte das Startziel, alle Gruppen die Frame-Abnahme. Spätere v2-n1-Diagnose auf 2616 / `d92a3b9`: vier vollständige Samples erhalten, DOM 68,5/50,1ms und 100,2/53,9ms, Ressourcen während Bewegung/Reveal überall 0, aber zwei instabile Kalibrierungen, unveränderte 33.x-Rohfails und verbleibende Carousel-50ms-Lücken. Profilierte Ursachenanalysen auf 5312 / `ebeed3e` ersetzen keine unprofilierte Wiederholungsmatrix. Die Wirkung der jüngsten Fokus-/Paintkorrekturen ist noch nicht gemessen. Allgemeine Aktivierung bleibt gesperrt; Nutzung über `?stagedNavigation=1`. |

Der letzte vollständige Framework-Integrationsnachweis gilt für `d92a3b9`: 840/840 Units in 114 Dateien, Workspace-Typechecks 0/0 und Paket-/Demo-Build 2616 grün. `ebeed3e` ergänzt 26/26 gezielte Readiness-/Ground-Units und Core-Typecheck. Für die jüngsten Folgekorrekturen gelten ausschließlich die nachstehenden gezielten Nachweise; ein vollständiger Unitlauf, Produktionsbrowserergebnis oder Performancegewinn auf diesen neuen Commits wird damit nicht behauptet.

- `2218421`: [abbrechbare Paint-Gelegenheit vor Ownership-Cleanup](design/layout/staged-cleanup-paint.md), gezielte Controller-Units grün; separate Hero-/Dock-Browsernachweise stehen aus. Reveal-Endmarker und Rohgates bleiben unverändert.
- `8eaf276`: [eng begrenzte Carousel-Aktivierungsfokus-Koaleszierung](design/layout/catalog-activation-focus.md), 50/50 Tests in fünf Dateien und Core-Typecheck grün; sechs vorbereitete Produktionsbrowserfälle stehen aus. Nativer Fokus und reguläre Tastatur-/Pointerpfade bleiben erhalten.

Nächste Abfolge: gemeinsame Produktionsprüfung dieser Änderungen, danach unveränderte unprofilierte Diagnosemessung und erst bei belastbarem Ergebnis weitere Wiederholungsmatrizen. Keine Aktivierung aus n1-Werten, Profilertimings oder ausschließlich funktional grünen Tests ableiten.
