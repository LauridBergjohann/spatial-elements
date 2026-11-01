# Umsetzungsplan: Layoutsystem und anschließende Katalog-Transitions

Stand: 1. November 2026. Status: Layout und frühe Transition funktional integriert; vollständiger Produktionsnachweis 24/24 auf Runtime `83ea019`, Demobuild `39337`. Die nachfolgende Warmup-Änderung `60deaac` ist noch nicht im Browser abgenommen. Performance-/Geräteabnahme und allgemeine Aktivierung bleiben offen. Die frühe Transition ist weiterhin Opt-in über `?stagedNavigation=1`; Fortschritt und revisionsgebundene Nachweise stehen im Arbeitsprotokoll.

Dieser Plan ist die Arbeitsgrundlage für das Framework und die Brand Examples. Er setzt die aktualisierten Layoutentwürfe und die nachträglichen Entscheidungen des Autors um. Erst wird das Layout verlässlich, anschließend wird der vorhandene [Plan für mehrstufige Katalog-Transitions](staged-catalog-transitions-plan.md) darauf aufgebaut. Bei widersprüchlichen Layoutannahmen hat dieses Dokument Vorrang.

Beide Repositories verwenden `feat/staged-catalog-transitions`. Ausgangspunkte der bisherigen Performance-Arbeit: Framework `8f647f0`, Examples `8d3c368`. Dieser Plan verlangt weder Veröffentlichung noch Versionsbump. Jeder Umsetzungsschritt erhält einen eigenen überprüfbaren Commit; betroffene Repositories werden getrennt committet und im Arbeitsprotokoll miteinander verknüpft.

## 1. Ziel und Reihenfolge

Das Layout soll aus bekannten Regeln entstehen: sieben Viewportlayouts für die Gesamtkomposition, vier containerabhängige Inhaltsraster für Autoren. Dieselben Regeln müssen HTML, 3D-Framing und spätere Transition-Ziele bestimmen. Inhalte bleiben responsiv, die Dokumentnavigation bleibt erhalten, und große Bildschirme bekommen mehr räumliche Präsentation statt unbegrenzt breiter Texte.

Die Arbeit erfolgt in dieser Reihenfolge:

1. Quellen, Regeln, Messfälle und öffentliche Verträge sichern.
2. Gemeinsame Layoutberechnung, Raster, Sections und Karten aufbauen.
3. Lebensdauer echter Panel-Komponenten nachweisen und die gemeinsame Shell umstellen.
4. Detailseite, Carousel und das 3XL-Layout integrieren; Medien und Interaktion ergänzen.
5. Bestehende Navigation auf dem neuen Layout stabilisieren.
6. Die frühe, mehrstufige Transition implementieren und messen.
7. Migration, bebilderte Wiki-Dokumentation und Gesamtprüfung abschließen.

Dokumentation wächst in jedem Schritt mit. Der eigene Dokumentationsschritt am Ende dient der Zusammenführung, Bildproduktion und Prüfung, nicht dem nachträglichen Rekonstruieren von Entscheidungen.

## 2. Quellen und verbindliche Entscheidungen

### Quellenstand und Priorität

Ausgangspunkt sind die am 31. Oktober aktualisierten Dateien im Workspace-Ordner `assets/`: `Layout.png`, `Content Grid.png`, `Cards.png`, `Sections.png`, `Layout Erläuterungen.pdf` sowie die vier SVG-Icons. Dieser Ordner liegt aktuell außerhalb der beiden Git-Repositories. Schritt 01 macht die benötigten Referenzen und ihre Herkunft im Framework-Repository nachvollziehbar.

Bei Abweichungen gilt: ausdrückliche spätere Nutzerentscheidung vor Bild/PDF; anschließend die in Schritt 01 konsolidierte Spezifikation. Widersprüche werden dort mit ihrer Auflösung vermerkt. Zahlen werden beim Implementieren nicht erneut aus konkurrierenden Quellen ausgewählt.

| Bereich | Festgelegte Regel und Grund |
| --- | --- |
| Layout und Raster | Layout reagiert auf Viewportbreite, Content Grid auf seine Containerbreite. Autoren gestalten nur vier Rastergrößen. |
| Inhaltsbreite | Maximal 1536 CSS-Pixel, ausdrücklich auch bei Layout L. Section-Padding zählt innerhalb dieser Breite; nicht nochmals außen addieren. |
| Detailseite 3XL | Linke Pane-Kante bei `viewportWidth / 2 + 8px`. Pane und Content Grid maximal 1536px. Bei Erreichen des Maximums bleibt die linke Kante dort und rechts entsteht zusätzliche freie Fläche. |
| Carousel 3XL | Komposition wie 2XL, Eigenschaftenpanel 480px breit. 24px Section-Padding und 16px Abstand unter einer vorhandenen Headline im großen Raster. |
| Panelhöhen | Inhaltsabhängig. Während der Bewegung bleibt das vorhandene Panel mit seinem bisherigen Inhalt erhalten. Zusätzlicher Inhalt und daraus entstehende Höhe folgen in der Inhaltsphase. Gleichbleibende Breite bedeutet nicht gleiche Höhe. |
| Echtes DOM | Bestehende Darstellung möglichst mit der tatsächlichen Komponente übernehmen. DOM-Verschieben allein verlängert deren Svelte-Lebensdauer nicht; dafür ist ein dauerhafter Besitzer nötig. |
| Scrollen in 3XL | Die ganze Seite bleibt das Scroll-Dokument. Kein eigener vertikaler Scrollcontainer für die Content-Pane. Linke Bühne, Hauptmenü, Pane-Kopf und Submenü bleiben in ihrer vorgesehenen Position. |
| Eingabe in 3XL | Bei 3D bedient die linke freie Fläche die Geometrie, rechts wird die Seite gescrollt. Bei Bild/Video wird auch links die Seite gescrollt. Bei ausgeblendeter Pane bedient die gesamte freie Fläche 3D. Bedienelemente behalten Vorrang. |
| Karten | S/M/L belegen 1/2/4 Spalten, L im sechsspaltigen S-Raster ausdrücklich 3. Eine ListSection hat eine einheitliche Kartengröße; Standard M und linksbündiger Text. |
| Kartentext | S-Titel wird mit den erlaubten 9px geplant. M/L 12/18px; Titel-Lineheight S/M/L 18/20/24px laut aktualisierter Grafik. Vorgeschriebene Zeilenanzahl, längere Texte mit Ellipsis. |
| Medienbereich | Karte 1:1; Medien-Fitbereich 4:3. Bild und Geometrie behalten ihre Proportionen und passen vollständig hinein. Hover darf die Geometrie darüber hinaus vergrößern. |
| Section-Hintergründe | Transparent, Standard und Muted; Verläufe nur bei tatsächlich vollflächigem Hintergrund. Zwei Themenradien für kleine Bedienelemente/Karten und große Panels/freistehende Sections. |
| Freistehende Sections | Regeln für zusammenhängende Gruppen auch auf normalen ContentPages in 3XL. Innerhalb der Detail-Pane 3XL keine zusätzlichen freistehenden Section-Rundungen. |
| Inhaltsaufteilung | Autoren platzieren einzelne Blöcke auf Rasterspalten. Kein automatischer mehrspaltiger Textfluss. |
| Bild/Video | Der 3D-Hintergrund wird ausgeblendet. Rückkehr zur Detailseite beginnt wieder mit dem ersten 3D-Medium; Medienauswahl nicht in die History aufnehmen. |
| Hauptmenü | Framework besitzt Position, Maße und Oberfläche, Anwendung liefert Inhalte. Scrollverhalten nach bergjohann.com; Detail-3XL bleibt die ausdrücklich feststehende Ausnahme. |

### Kanonische Größen

Alle Breiten beziehen sich auf CSS-Pixel, unabhängig von `devicePixelRatio`. Intervallgrenzen werden als Untergrenzen formuliert, damit auch gebrochene CSS-Breiten eindeutig sind.

| Viewportbreite | Layout | Inhaltsbreite laut Entwurf |
| --- | --- | --- |
| `< 600` | XS | unter 600 |
| `600 <= w < 840` | S | 600 bis unter 840 |
| `840 <= w < 1200` | M | 840 bis unter 1200 |
| `1200 <= w < 1600` | L | 1200 bis maximal 1536 |
| `1600 <= w < 1809` | XL | 1328 bis maximal 1536 |
| `1809 <= w < 2300` | 2XL | 1536 |
| `w >= 2300` | 3XL | Detail-Pane zunächst 1122 bis unter 1200; ab `w = 2456` 1200 bis maximal 1536 |

Die schmale rechte Detail-Pane in 3XL darf nicht versehentlich auf normale ContentPages oder das Carousel übertragen werden. Das Carousel verwendet dort ausdrücklich die 2XL-Komposition. ContentPages behalten ihren eigenen, auf 1536px begrenzten Inhaltsbereich.

| Content-Containerbreite | Grid | Spalten | Margin/Gutter/Section-Padding | Headline Größe / Höhe | Text Größe / Höhe | Headline-Abstand |
| --- | --- | --- | --- | --- | --- | --- |
| `< 600` | XS | 4 | 12 | 18 / 28 | 14 / 20 | 8 |
| `600 <= c < 840` | S | 6 | 16 | 18 / 28 | 14 / 20 | 8 |
| `840 <= c < 1200` | M | 8 | 16 | 20 / 32 | 14 / 20 | 12 |
| `1200 <= c <= 1536` | L | 12 | 24 | 24 / 40 | 16 / 24 | 16 |

Headlines sind semibold, Fließtext regular. Querybreite `c` ist die Breite **vor** dem Section-Padding. Sonst würde beispielsweise ein 840px-Container nach Abzug von 32px irrtümlich Raster S wählen. Margin und Section-Padding repräsentieren denselben Innenrand und dürfen nicht doppelt angewandt werden.

### Bereits aufgelöste und noch technisch zu präzisierende Details

Keine erneute Produktklärung ist nötig für 1536px, 480px, 24/16px, L-Karten im S-Raster, Panelhöhen oder Dokument-Scrolling. Verbleibende Umsetzungsdetails werden in Schritt 01 ausdrücklich festgehalten:

- PDF und Kartenbild nennen teils weiterhin 8px für S und allgemein vier Spalten für L. Hier gelten die Nutzerkorrekturen 9px und drei Spalten in Grid S. Das M-Headline-Label im Gridbild nennt 28px, Bemaßung und PDF nennen 32px; geplant sind 32px.
- Ein Gradient darf laut neuer Regel nur bei effektiv vollflächigem Hintergrund entstehen. Detailseiten beschränken `Full` auf die normale Inhaltsbreite. **Umsetzungsvorschlag:** In diesem Kontext keinen Gradient rendern; im Entwicklungsbetrieb auf die unzulässige Kombination hinweisen und auf eine dokumentierte einfarbige Variante normalisieren. Als deterministischer Fallback bietet sich die Endfarbe des Verlaufs an. Die alternative Deutung „Full angefordert reicht aus“ würde die neue Regel und die vereinfachte Radienlogik wieder aufweichen. Diese Normalisierung ist ein technischer Vorschlag, keine bereits vom Nutzer bestätigte Farbentscheidung.
- Bei sehr kleinen Karten reicht ein starr reserviertes unteres Viertel nicht immer für die vorgegebenen Zeilenhöhen: bei 320px Grid XS ist eine M-Karte 142px breit, ihre Viertelhöhe 35,5px, zwei Textzeilen benötigen 40px. **Umsetzungsvorschlag:** Benötigte Textzone reservieren und den weiterhin 4:3 großen Medien-Fitbereich innerhalb der verbleibenden Fläche proportional verkleinern/zentrieren. Keine heimliche Schriftverkleinerung oder Verzerrung. Das wird mit einer 320px-Referenz geprüft und als Ausnahme dokumentiert.
- Zeilenhöhen für Eyebrow, Innenabstände eigener Panel-Snippets, extrem kurze Fenster, Safe Areas und verspätet geladene Schriften werden als explizite technische Regeln ergänzt. Ableitungen aus den Zeichnungen werden von bereits festgelegten Werten unterschieden.

## 3. Architektur und Grenzen

### Ein Layoutvertrag für HTML und 3D

Ein DOM-unabhängiger Resolver im Core erhält Viewport, stabile nutzbare Höhe, Safe Areas, Seitentyp und Darstellungszustand. Er liefert Layout-/Rasterklasse, Containerbreiten, feste Anker, Media-Fitbereiche, Panelbreiten und Höhenobergrenzen sowie Header-/Dock-/Pane-Bereiche. CSS verwendet dieselben Tokens/Formeln. Ein Build-Schritt zur Ableitung statischer CSS-Regeln ist möglich; zwei unabhängig gepflegte Konstantensammlungen sind ausgeschlossen.

Der Resolver verspricht keine vorab bekannte Höhe beliebiger Inhalte. Finaler Section-Fluss, intrinsische Panelhöhe, Bild-/Video-Ladezustand und Anchor-Ziele bleiben inhaltsabhängig. Für die erste Bewegung werden bekannte Anker und Grenzen mit der vorhandenen Quellhöhe kombiniert. Auf XS/S und im integrierten 3XL-Panel wird zusätzlicher Inhalt erst nach der Bewegung hergestellt. DOM-Messung bleibt für diese späteren Inhalte und zur Verifikation erlaubt.

SSR muss ein korrektes responsives Layout ohne `window` erzeugen. CSS positioniert die native Darstellung; nach Hydration synchronisiert sich der Core vor der erweiterten Darstellung damit. Kein erst nach JavaScript sichtbar werdendes Grundlayout. Mobile Browserleisten dürfen keinen vollständigen Layout-/Framing-Neuaufbau bei jedem Höhenpixel auslösen; die vorhandene Stabilisierung wird bewahrt und gegen echte Orientierungswechsel abgegrenzt.

### Echte Panel-Komponenten behalten

Ja, das tatsächliche DOM kann erhalten bleiben. Während der ersten Bewegung hält das Navigations-Gate die Quellroute ohnehin montiert. Über den Route-Commit hinaus benötigt die Komponente einen Besitzer in der dauerhaften Stage/Shell außerhalb der wechselnden Route.

Der geplante Vertrag trennt daher dauerhafte Panel-Instanz und seitenabhängigen Layoutplatz. Quelle und Ziel beanspruchen dieselbe Instanz über einen eindeutigen Besitzer/Lease. Die Instanz hält DOM, Svelte-Effekte, Eingabezustand und den Query-Container; die Route liefert Platzierung und Daten. Ein gespeicherter Verweis auf ein routeabhängiges Snippet reicht dafür nicht. Snippet-Definition und Zustand müssen ebenfalls eine geeignete Lebensdauer besitzen.

Die Liste hat zunächst ihren Kartentext, nicht bereits den vollständigen Detailinhalt. Dieser wird während der Bewegung erhalten und erst in der Inhaltsphase ersetzt/ergänzt. Beim Carousel können tatsächlich identische Eigenschafteninhalte weiterleben. Für beliebige vom Host gelieferte Panels wird nur die nachgewiesene Persistenz zugesichert; die öffentliche API erklärt Voraussetzungen und Zustandsbesitz.

Keine Klone interaktiver Controls als allgemeine Lösung. Fokuswechsel durch Navigation erfolgt bewusst nach dem vereinbarten Navigationsvertrag; unabsichtlicher Fokusverlust während der Übergabe ist davon zu unterscheiden. Quelle und Ziel dürfen nie zwei gleichzeitig aktive Formulare für dieselbe Instanz erzeugen.

DOM-Identität allein garantiert noch keine ruhige Bewegung: Eine pro Frame geänderte Querybreite könnte Text und freie Snippets fortlaufend neu umbrechen. Während der Bewegungsphase bleiben deshalb Quell-Querybreite und Inhaltslayout stabil; zunächst verändert sich nur die äußere Darstellung. Text darf dabei nicht durch nichtproportionale Skalierung verzerrt werden. Ziel-Querybreite, neuer Spaltenmodus und zusätzliche Höhe werden erst in der Inhaltsphase wirksam. Verspätete Daten-/Fontänderungen sind Teil dieses Stabilitätsnachweises; frei gestaltete Snippets dürfen den Vertrag nicht unbemerkt umgehen.

### 3XL: ein Dokument, zwei visuelle Bereiche

Die rechte Pane ist ein Sichtfenster auf den Inhalt des Dokuments. Pane-Kopf und Submenü stehen fest, ihre Inhaltsfläche zeigt den durch den Dokument-Scroll versetzten Inhalt. Vorhandene virtuelle Scroll-Infrastruktur kann dies abbilden, muss aber von „gesamten Seiteninhalt gleich verschieben“ auf die vorgesehenen Bereiche umgestellt werden.

Für den ersten Prototyp sind zwei Varianten zu vergleichen: möglichst native Dokumentgeometrie mit sticky/fixed Bereichen und die bestehende Dokument-Proxy-Lösung mit gezieltem Clipping. Gewählt wird die einfachere Variante, die Anchorlinks, Browser-Finden, Tab-Fokus, History, Tastaturscrollen und JS-Fallback erfüllt. Das äußere Dokument bleibt in beiden Varianten Scroll-Eigentümer. Die Spezifikation darf nicht durch einen inneren `overflow-y: auto`-Pane-Scroller umgangen werden.

Höhe des Dokumentbereichs, sichtbare Pane-Höhe, obere/untere Reserven und Scrollversatz erhalten eine gemeinsame Abbildung. Native und programmatische Navigation, Scrollspy und die 3D-Viewport-Abbildung verwenden dieselbe Abbildung. Zoom blendet die Pane aus, ohne deren Dokument-Scrollposition zu verlieren; unsichtbare Pane-Inhalte bleiben nicht per Tab erreichbar.

MediaRail und höhenbegrenzte Eigenschaftenpanels dürfen weiterhin die ausdrücklich vorgesehenen lokalen Überläufe behandeln. Diese begrenzten Komponenten sind keine zweite Seiten-Scrollwurzel.

### Menü, Glas und Breakpointwechsel

Die geprüfte Referenz ist [bergjohann-com, Commit 5463b791](https://github.com/LauridBergjohann/bergjohann-com/commit/5463b791d1770f0f9580105be338f589275e984b). Das Menü bleibt für die ersten 112px Dokument-Scroll an seiner Ausgangsposition; danach gilt `y = initialY - max(0, scrollY - 112)`. Es erscheint beim beliebigen Hochscrollen weit unten nicht sofort wieder. Menü und Satelliten bewegen sich gemeinsam. [Implementierung](https://github.com/LauridBergjohann/bergjohann-com/blob/5463b791d1770f0f9580105be338f589275e984b/src/lib/components/header/Header.svelte), [Tests mit/ohne JavaScript](https://github.com/LauridBergjohann/bergjohann-com/blob/5463b791d1770f0f9580105be338f589275e984b/tests/header-scroll.e2e.ts).

Übernommen wird das Verhalten, nicht die dortige Geometrie. Das neue Figma-Layout bestimmt Maße und Breakpoints. In Detail-3XL bleibt das Menü fest. Unter virtuellem Scroll darf native Sticky-Verschiebung nicht zusätzlich zur berechneten Verschiebung wirken.

Für normale ContentPages wird durchgehend die DOM-Oberfläche des Menüs empfohlen. Sie kann HTML-Inhalte darunter berücksichtigen; der aktuelle WebGPU-Glaseffekt liest nur den Canvas-Hintergrund. Für eindeutig über Canvas liegende Detail-Controls bleibt der GPU-Pfad entsprechend der vorgesehenen Matrix. Bei gemischtem Untergrund wird der Oberflächenmodus aus dem Seiten-/Layoutkontext bestimmt, nicht durch teure Überlappungssuche in jedem Frame. Die Inhaltsinstanz bleibt beim Oberflächenwechsel erhalten. Nicht-Glass-Themes benötigen keine solche optische Unterscheidung.

Die unterschiedliche Spaltenzahl verursacht an Breakpoints einen echten Umbruch. Geplant ist ein sofortiger, stabiler Reflow mit fließenden Breiten innerhalb der Intervalle; keine Animation aller Karten während Resize. Das schützt Lesbarkeit und verhindert konkurrierende Layout-/3D-Animationen. Orientierungswechsel, Split-Screen und Browserzoom sind wichtige Testfälle, auch wenn Desktopnutzer die Fenstergröße selten ändern. Auswahl, Fokus und logischer Leseort bleiben erhalten; laufende Transitions werden kontrolliert abgeschlossen oder abgebrochen.

## 4. Commitbare Umsetzungsschritte

Der aktuelle Status steht im Arbeitsprotokoll. Namen neuer APIs/Dateien werden in Schritt 01 konkretisiert. Bestehende Funktionen bleiben bis zum jeweiligen Integrationsnachweis benutzbar. Eine interne Umschaltung darf die Migration absichern, soll aber keine dauerhafte zweite Layoutimplementierung erzeugen.

### 01 — Spezifikation, Referenzen und Abnahmefälle sichern

**Commit:** `docs: specify responsive layout and validation contract`

- In `docs/design/layout/` kanonische Maße, Zustandsdiagramme, Herkunft und Entscheidungsprotokoll ablegen. Aktualisierte Quellen übernehmen oder als verlustfreie, nachvollziehbare Ausschnitte archivieren; Quelldatum und Hash dokumentieren. Private Brand-Inhalte gemäß vorhandener Repo-Grenze behandeln; öffentliche Referenzen durch eigene Demo-Assets illustrieren.
- Alle sieben Layoutvarianten aus der großen Zeichnung in lesbare Referenzblätter zerlegen: Standard, gescrollt, Zoom und Carousel. Grüne Fitbereiche, blaue Maximalhöhen, gelbe Rail-Grenzen und violette Submenü-Grenzen als Formeln erfassen, nicht allein als Bild behalten.
- Die oben markierten technischen Vorschläge festlegen; jeden Wert auf Quelle oder begründete Ableitung zurückführen. Unter anderem klären: Rahmen/Innenmaß der Pane, Safe-Area-Verrechnung und Verhalten bei zu geringer nutzbarer Höhe.
- API-Entwurf für Rasterplatzierung, Section-Headline/Background/Size, Kartengröße/Ausrichtung, zwei Radien, Shell-Menü/Satelliten, persistente Summary-Snippets und Medien schreiben. Bisherige Einstellungen auf neue abbilden; keine stillen Inhaltsverluste.
- Repräsentative Testinhalte festlegen: kurze/lange Texte, mit/ohne Eyebrow/CTA, lange frei gestaltete Summary mit Eingaben, 0/1/viele Sections und Medien. Öffentliche Demo unabhängig vom privaten Examples-Repo halten.

**Abnahme:** Für jede gezeichnete Region sind Eingaben, Formel, Überlauf und zuständige Komponente beschrieben. Keine unaufgelösten Zahlenkonflikte für den ersten Implementierungsschritt. Quellen- und Dokumentlinks sind prüfbar. Noch keine Runtime-Änderung.

### 02 — Gemeinsame Tokens und reinen Layoutresolver implementieren

**Commit:** `feat(core): add shared responsive layout resolver`

- Core-Modul für Viewportlayout, Content-Grid, Insets, Shell-/Hero-/Dock-/Pane-Anker und Framing-Eingaben. Alte Komponenten zunächst unverändert weiterbetreiben.
- Aus derselben Quelle CSS-Tokens/Breakpoints bereitstellen. Rundung, Border-Box, Scrollbarbreite und Safe-Area-Semantik festlegen; Referenz ist die tatsächliche CSS-Layoutbreite, nicht die physische Bildschirmbreite.
- Unbekannte Inhaltshöhe typisiert von festen Größen/Maximalhöhen unterscheiden. Resolver darf weder `getBoundingClientRect()` noch GPU-Zugriffe benötigen.
- Bestehende stabile Viewportmessung und Orientierungsbehandlung anbinden, ohne den adressleistenbedingten Stretch-Fehler zurückzubringen.

**Prüfung/Abnahme:** Reine Tests direkt unter/auf/über allen Grenzen, einschließlich 1536px-Cap, 2456px-Gridwechsel und Erreichen des 3XL-Pane-Caps. Test `paneLeft = w/2 + 8` bleibt auch oberhalb des Caps erfüllt. Verschiedene Fensterhöhen, DPR und Safe Areas liefern endliche, plausible Bereiche. Architektur-/Paketgrenzen bleiben eingehalten.

### 03 — Content Grid und ContentPage integrieren

**Commit:** `feat(sveltekit): render content pages with container grids`

- `ContentPage.svelte` und einen wiederverwendbaren Grid-/Blockvertrag auf die neuen Containerbreiten und Rasterspalten umstellen. Alte 1500px-/900px-Sonderregeln ersetzen.
- Explizite Spaltenbelegung je XS/S/M/L ermöglichen. DOM-Lese- und Fokusreihenfolge bleibt Autorenreihenfolge; kein visuelles Umsortieren durch dichtes automatisches Auffüllen.
- Container Queries auf dem ungepaddeten Gridcontainer verankern. Einbettung schmaler Container in großen Viewports prüfen, insbesondere Detail-Pane 3XL.
- Öffentliche Demo um eine kleine Referenzseite mit Rasterhilfen und verschieden breiten Inhaltsblöcken ergänzen. Native Darstellung und WebGPU-Version teilen dieselbe Grundgeometrie.

**Prüfung/Abnahme:** CSS und Resolver stimmen bei bekannten Rechtecken bis auf höchstens 1 CSS-Pixel überein. Gridklassen wechseln nach Containerbreite, nicht Viewport. Kein doppelter Außenrand, kein horizontaler Seitenoverflow. SSR/ohne JavaScript, Textzoom und Tastaturreihenfolge prüfen.

### 04 — Section-Semantik, Themenfarben und Radien umstellen

**Commit:** `feat: add grid sections and contextual backgrounds`

- `Section.svelte`, Section-Typen, Registry und Theme erweitern: `id`/Navigations-Titel getrennt von optionaler sichtbarer Headline, Rasterpadding, Standard/Muted/Transparent und gültige Vollflächen-Verläufe.
- Page-Background-Override der ContentPage sowie die zwei Radiusrollen in DOM- und GPU-Panels konsistent abbilden. Alte Theme-Konfiguration über einen dokumentierten Migrationspfad behandeln.
- Section-Nachbarschaft anhand des normalisierten Hintergrunds auswerten: zusammenhängende freistehende Gruppen nur außen abrunden, transparente/vollflächige Nachbarn korrekt als Grenze behandeln. ContentPage-3XL einschließen, Detail-Pane-3XL ausschließen.
- Fehlende Headline erzeugt keinen leeren Headline-/Spacerblock. Bestehende Detail-Content-Sichtbarkeitsoptimierung beibehalten und an neue Abstände anpassen.
- Sections ohne sichtbare Headline behalten ihren zugänglichen Namen aus dem Navigationstitel; kein `aria-labelledby` auf einen nicht vorhandenen Headline-Knoten.

**Prüfung/Abnahme:** Kleine Regeltests für Hintergrundnormalisierung und Gruppenecken; Browserbilder für Kombinationen vor/nach transparenten und Full-Sections, Themes und Seitentypen. Anchors, Navigations-Titel und zugängliche Section-Namen bleiben unabhängig von sichtbaren Headlines nutzbar.

### 05 — ListSection und Karten auf das Raster umstellen

**Commit:** `feat: add grid sized spatial element cards`

- `ListSection.svelte`, `SpatialElementCard.svelte` und Karten-Framing in `CatalogSpatialElementLayer` auf S/M/L, Span-Ausnahme und Textausrichtung umstellen. Die bisherige Auto-Fill-Mindestbreite 250px und feste 228px-Medienhöhe ersetzen.
- 1:1-Karte und 4:3-Fitbereich gemeinsam für Poster und 3D ableiten; kleine Viewports nach der in 01 festgelegten Textreserve behandeln. Titel- und Eyebrow-Zeilen, Lineheight und Ellipsis explizit umsetzen.
- Vollständiger Titel bleibt als zugänglicher Linkname verfügbar. Kleine S-Karten begrenzen den Text, nicht die Information im zugänglichen Namen. Hover darf sichtbar über den Fitbereich wachsen und darf keine Nachbarlinks blockieren.
- Vorhandene Sensorrichtung, Intensität, Scrollpause und Rekalibrierung sowie Maus-Näherungsrotation erhalten.

**Prüfung/Abnahme:** Referenzbilder für alle Kartengrößen in allen vier Rastern, lange Titel und gemischte Eyebrows. L-in-S ergibt zwei Karten je voller Reihe. Poster/3D bleiben unverzerrt; 320px und Textzoom ohne Textüberlagerung. Native Links, Tastatur, Touchscrollen und Rückkehr zur Auswahl bleiben korrekt.

### 06 — Lebensdauer einer echten Panel-Komponente beweisen

**Commit:** `refactor: retain live panel components in the stage shell`

- Kleine vertikale Integration in einer Test-/Demo-Route: dauerhafter Presentation-Host außerhalb wechselnder Routen, registrierte Quell-/Zielplätze, eindeutiger Lease und symmetrische Freigabe.
- `PresentationLease`, `SpatialPageRegistry`, `PanelPresentationController` und Svelte-Ownership zusammenführen. Ein `appendChild()` aus einer sterbenden Route zählt nicht als Lösung.
- Ein tatsächlich interaktives Summary-Snippet samt Query-Container, Zähler, Variantenauswahl und Eingabe über einen Route-Commit behalten. Persistente Snippet-Definition/Datenhaltung ausdrücklich nachweisen.
- Register-/Lease-Verhalten ohne erweiterte GPU-Darstellung bereitstellen. Verdeckte Instanzen sind weder doppelt bedienbar noch doppelt im Accessibility Tree.
- SSR und Hydration gehören zum Prototyp: Direkteinstieg liefert Panelinhalt bereits im HTML, Registrierung nach Mount erzeugt kein Loch und keine zweite interaktive Instanz.
- Stabile Quell-Querybreite während einer simulierten Breitenänderung nachweisen; finalen Container-Reflow erst bei der Inhaltsübergabe erlauben. Späte Daten/Fonts und Wechsel von einer auf zwei/drei Spalten einbeziehen.

**Prüfung/Abnahme:** Gleiche DOM-Identität und erhaltene Werte vor/nach Route-Commit; Effekte weiter aktiv, Cleanup genau einmal. Keine Verdopplung oder Inhaltslücke bei SSR/Hydration, kein fortlaufender Query-Reflow während Bewegung. Abbruch, veraltete Freigabe und mehrfacher schneller Wechsel zerstören keinen neueren Besitzer. Fokus folgt dem festgelegten Navigationsverhalten. Dies ist ein Architektur-Gate vor der breiten Snippet-API und der schnellen Transition.

### 07 — Gemeinsame Shell, Hauptmenü und Breadcrumbs integrieren

**Commit:** `feat: add layout owned navigation shell`

- `BrandStageShell` stellt dauerhafte Slots für Menü und Satelliten bereit; Inhalte bleiben anwendungsseitig. Feste Maße kommen aus dem Resolver. Kleinere Layouts verlagern Satellitenfunktionen über die Host-Menüinhalte in erreichbare Einstellungen.
- 112px-Verhalten der Referenz umsetzen, mit fester Ausnahme Detail-3XL. Enhanced Scroll und native CSS-Fallbacks teilen dieselbe Bewegungsregel. Offene Menüs/Popover folgen der Oberfläche und werden beim Navigieren kontrolliert geschlossen.
- DOM-Oberfläche für normale ContentPages, GPU-Glass nur bei garantiert geeignetem Canvas-Untergrund. Navigation darf den dauerhaft sichtbaren Header nicht kurz ausblenden.
- Breadcrumb-Größen 10/12/14px und Höhen 24/30/40px je Layoutgruppe; einzeilig, horizontal scrollbar und Ende sichtbar. Detail-3XL blendet nur den aktuellen Seitentitel im Breadcrumb aus, behält den abschließenden Trenner.
- Demo und anschließend Brand-Shells an die neue Zuständigkeit anpassen; keine zweite Menüpositionierung im Host behalten.

**Prüfung/Abnahme:** Position bei Scroll 0/48/112/140/300 und Rückkehr, mit/ohne JavaScript. Menü über DOM ist lesbar, Popover und Fokus funktionieren. Liste/Carousel → Detail oben zeigt keinen Header-Ausfall. 3XL und Wechsel in/aus 3XL gesondert prüfen.

### 08 — Detail-Hero XS bis 2XL und Summary-Snippets integrieren

**Commit:** `feat: render detail heroes from shared layout rules`

- `SpatialElementPage`, Summary-Panel/-Content, MediaRail, `StageExperience` und Dock-Inset-Anbindung auf den Resolver umstellen. Bisherige 1100px-Grenzen, festen 494px-Panelbreiten und pauschalen Hero-Mindesthöhen ablösen.
- Rail horizontal XS/S, sonst vertikal; grüner Fitbereich für Bühne und Position der Controls; Summary oben bündig, natürliche Höhe bis zur vorgesehenen Obergrenze, XS/S im Dokumentfluss.
- Freie Summary-Snippets mit eigenem Query-Container anbieten; sinnvoller Default für bestehende Elementdaten. Ein-, zwei- und später dreispaltige Beispiele zeigen, ohne Anwendungstext fest im Framework zu kodieren.
- Begrenzte Summary-Überläufe, Fokus in Controls und ausbleibende Inhalte definieren. Minimap-Position/-Größe beim Zoom nach Entwurf, automatische Hintergrunddarstellung weiter konsistent.

**Prüfung/Abnahme:** Alle sechs Layoutgrößen oben/Zoom, lange/kurze Summary und fehlende CTA. Resolver gegen tatsächliche feste Anker und Grenzen prüfen; variable Höhe gegen die vereinbarte Grenze statt gegen erfundene Fixwerte. Direkteinstieg, SSR, vorhandene Navigation und kleine Fensterhöhen bleiben nutzbar.

### 09 — Scrollheader, Submenü und Surface-Wechsel integrieren

**Commit:** `feat: align detail docking and section navigation`

- `SpatialElementStickyHeader`, `SpatialElementTabs`, `SpatialElementDockController` und Section-Registry auf gemeinsame Anker/Reserven umstellen.
- Scrollheader mit Minimap/3D, Titel, optionaler Eyebrow und CTA-Icon. Submenü ab M, Overview-Icon statt Text, restliche Einträge aus Sections, horizontaler Überlauf und sichtbarer aktiver Eintrag.
- M–2XL: Submenü folgt dem Dokument bis zum Docken. Der Übergang GPU-/DOM-Glass verändert weder Layout noch lebenden Inhalt. Scrollspy und Anchor-Offsets berücksichtigen die tatsächlich belegte Headerfläche.

**Prüfung/Abnahme:** Direktlink auf Section, Wiederherstellung aus History, Tastatur und lange Menütexte. Docken/Entdocken ohne Positionssprung, doppelte Controls oder verdecktes Anchor-Ziel. Eigenschaftenpanel und Scrollheader wechseln ihre CTA-Sichtbarkeit kontrolliert.

### 10 — 3XL mit Dokument-Scrolling und festem Bühnenbereich umsetzen

**Teilcommits:** `test: prove ultra wide document scroll mapping`, `feat: add document scrolled ultra wide detail layout`, `feat: preserve ultra wide pane state during zoom`

10a beweist die Scrollabbildung in einer isolierten Fixture mit nativen Anchors/Fokus. 10b integriert die feste Bühne und Pane ohne Zoom. 10c ergänzt Zoom, CTA-Sichtbarkeit und Layoutwechsel. Jeder Teil wird vor dem nächsten geprüft; das neue Layout bleibt bis zum vollständigen Nachweis intern abschaltbar.

- Zunächst den Scroll-Abbildungsprototyp aus Abschnitt 3 mit echten langen Inhalten prüfen; dann die gewählte Lösung in `VirtualScrollController`, `PageBindingController`, Scrollframe und Svelte-Seitenstruktur integrieren.
- Pane bei Mitte +8px und maximal 1536px; feste Bühne/MediaRail links, festes Hauptmenü, Pane-Kopf und unten mittiges Submenü. Summary im Pane-Fluss, kein eigener Pane-Seitenscroller.
- CTA im Pane-Kopf erscheint, sobald der relevante Summary-Bereich den Sichtbereich verlassen hat. Pane-Hintergrund ist Panel-Farbe; transparente Sections zeigen diesen Hintergrund, gegebenenfalls die Szene durch dessen Transparenz.
- Zoom verschiebt die gesamte Pane nach rechts, erhält Scrollzustand und passt Fokus/Hit-Testing an. Rückkehr stellt denselben Inhaltsort her.
- Wechsel zwischen 2XL und 3XL erhält Elementauswahl, logischen Leseort und Bedienbarkeit. Direkte Hashnavigation darf nicht einen zweiten unsichtbaren Scrollzustand erzeugen.

**Prüfung/Abnahme:** Nur `document.scrollingElement` steuert Seitenscrollen. Wheel/Touch/PageDown/Home/End, Anchorlinks, Browser-Finden, Tab-Fokus, Back/Forward und Reload mit Hash funktionieren. Ober-/Unterkante des Pane-Inhalts bleiben erreichbar, auch bei kurzer Seite und nach Font-/Bildnachladung. 2300/2456px sowie Breiten jenseits des Pane-Caps prüfen. Kein doppelt angewandter Scrollversatz.

### 11 — Bild-/Videomedien und Eingabebereiche vervollständigen

**Teilcommits:** `feat: add detail image selection and contextual input`, `feat: add native and embedded detail videos`

11a integriert zunächst 3D/Bild, Rail, Hintergrundwechsel und Eingabeflächen. 11b ergänzt native Videos und den eingebetteten Player mit dessen eigenen Grenzen. So bleiben Medienwechsel und zusätzliche Player-Lebenszyklen getrennt prüfbar.

- Typen/MediaRail um auswählbares 3D, Bilder, native Videodateien und YouTube ergänzen; erstes Medium immer 3D/Minimap. Weitere 3D-Posen sind eine spätere Erweiterung, keine Voraussetzung dieses Umbaus.
- Medien unverzerrt im Fitbereich zeigen. Beim Wechsel zu Bild/Video 3D-Modell und Szenenhintergrund ausblenden, nur dafür relevante 3D-Controls ausblenden und unnötiges 3D-Rendering aussetzen. Beim Verlassen eines Videos Wiedergabe stoppen; keine ungewollte automatische Wiedergabe.
- Video-UI ist ein eigener Interaktionsbereich. 3XL-Linksflächenregel nur auf freie Fläche anwenden; bei Bild/Video scrollt die freie Fläche die Seite, Playercontrols bleiben nativ bedienbar. Gestenbesitzer bei Beginn festlegen und nicht mitten in einer Bewegung wechseln.
- Ereignisse innerhalb eines fremden YouTube-iframes unterliegen dessen Player und können vom Host nicht zuverlässig umgeleitet werden. Freie Medienfläche, native Controls und eingebetteten Player separat prüfen und diese Grenze dokumentieren. Keine unsichtbare Abfangschicht über Playercontrols legen, um Seitenscrollen zu erzwingen.
- Beim Zoom ohne Pane freie Fläche über volle Breite für 3D nutzen. Bestehende Fullscreen-/Help-/Minimap-Controls bleiben erreichbar. Zurücknavigation startet wieder mit 3D; Katalogauswahl und Dokumentscroll bleiben unabhängig davon erhalten.

**Prüfung/Abnahme:** Medienwechsel, nicht ladbare Medien, Video-Pause/Teardown, Rail-Überlauf in beiden Richtungen und Rückkehr zur 3D-Darstellung. Maus, Touch und Surface-Stift/Hybrid prüfen. Hostflächen bleiben scrollbar, Playercontrols bedienbar; die Eingabegrenzen des fremden iframes werden ausgewiesen. Keine weiterlaufende unsichtbare Szene. Native Poster-/Medienfallbacks ohne WebGPU funktionieren.

### 12 — Carousel auf das gemeinsame Layout bringen

**Commit:** `feat: align carousel layout with detail presentation`

- `CarouselSection`, `CarouselSpatialElement`, `catalogPose` und `CatalogSpatialElementLayer` gemeinsam umstellen. Alte konkurrierende 700px-Grenzen beseitigen, Framing und Panelplatzierung aus dem neuen Vertrag beziehen.
- Section-Headline, Hintergrund, Padding und Abstände wie andere Sections; aktive Geometrie im vorgesehenen Bereich, vorhandene Orbit-/Auswahlbewegung beibehalten. Der Fitbereich ist keine neue harte Schnittkante für benachbarte Geometrien.
- Panel vertikal im vorgesehenen Bereich zentrieren, natürliche Höhe bis zur Obergrenze; XS/S auf Titel/Eyebrow reduzieren. Ab M passende Gridbreite, 3XL wie 2XL mit 480px. Detail-Link als Pfeil oben rechts statt „more information“; zugänglichen Namen behalten.
- Gemeinsame Panel-Instanz und Wrapper aus Schritt 06/08 nutzen. Bestehende Maus-Näherungsrotation, dezente Sensorperspektive plus stärkere aktive Geometrie und Scrollpause/Rekalibrierung beibehalten.

**Prüfung/Abnahme:** Alle Layoutgrößen, 1/wenige/viele Elemente, lange Summary, Pfeil/Tastatur, horizontaler und vertikaler Touchscroll. Kein Springen der aktiven Geometrie durch Kamera-/Paneländerung. Keine Bewegung von Panel, Pfeilen und Auswahlpunkten durch den Lagesensor. Bestehende Carousel-Paint-/Touch-Tests weiterführen.

### 13 — Neue Layouts mit der bestehenden Navigation stabilisieren

**Commit:** `test: cover responsive layouts across catalog navigation`

- Vor Aktivierung der frühen Bewegung alle Hin-/Rückwege mit dem bisherigen Übergabeverfahren auf dem neuen Layout prüfen. Restliche alte Mess-/Inset-Annahmen in Transition, Binding und Model-Fit entfernen oder klar auf inhaltsabhängige Messungen begrenzen.
- Öffentliche Demo und Brand Examples vollständig migrieren. Wurm prüft List/Carousel/Media/Summary, Watches insbesondere Header-Kontinuität und Rücknavigation. Private Markenbilder bleiben im Examples-Repo.
- Gemeinsame visuelle Vergleichsfälle für oben/gescrollt/Zoom/3XL und native Darstellung aufnehmen. Alte CSS-Overrides und interne Migrationsschalter entfernen, soweit der neue Pfad bereits vollständig geprüft ist.

**Prüfung/Abnahme:** Nutzbares neues Layout in beiden Repos mit alter Navigation; keine Sensor-, Scroll-, Header- oder Fallback-Regressionsfehler. Damit steht ein eigenständig reviewbarer Stand bereit, auch wenn die Performance-Transition noch nicht aktiviert ist.

### 14 — Frühe Transition auf dem fertigen Layout aufbauen

Dieser Schritt wird in mehrere Commits gemäß [Transition-Plan](staged-catalog-transitions-plan.md) geteilt, nicht als ein großer Abschlusscommit umgesetzt. Dessen Layoutschritte 2–4 werden durch die Nachweise dieses Plans erfüllt und nur noch auf Vollständigkeit geprüft.

- **14a — Gate und Messung:** frühes Navigationssignal, Route-Commit nach Bewegungsende, Abbruch-/Fehlerpfade; öffentliche SvelteKit-Integration gegen die tatsächlich installierte Version nachweisen.
- **14b — Übernahme:** persistente Quellgeometrie und echtes Panel mit Schritt 06 verbinden. Während der Bewegung weder Ziel-DOM mounten noch neue GPU-Pipelines vorbereiten. Quelle bleibt montiert, ihre Querybreite/Inhaltsbox stabil. Den späteren Ziel-Reflow mit verspäteten Fonts/Daten ausdrücklich prüfen.
- **14c — Liste → Hero:** erster kompletter Pfad, danach Liste → Dock. Quelle am bekannten Ziel halten, Ziel binden, anschließend Zusatzinhalt und zusätzliche Panelhöhe aufbauen/einblenden.
- **14d — Carousel → Hero/Dock:** Quellkamera, aktive Sensorpose und vorhandene Panelinstanz einbeziehen. Möglicherweise gleiche Breite, ausdrücklich nicht pauschal gleiche Höhe annehmen.
- **14e — 3XL-Ziele:** Liste und Carousel → feste linke Bühne/rechte Pane gesondert implementieren. Dort kein künstlicher mobiler Dock-Endpunkt. Scrollzustand bestimmt Pane-Inhalt/CTA, nicht eine nach oben wandernde Hauptgeometrie.
- **14f — Performance und Aktivierung:** erst nach bestandenen Bewegungs-, Übergabe- und Fehlerprüfungen aktivieren. Rückweg kann weiterhin das vorherige Verfahren verwenden.

Netzwerkdownloads sollen die Bewegungszeit nutzen. Routemount, schwere Modulinitialisierung, Datenverarbeitung und GPU-Vorbereitung dürfen sie nicht ruckeln lassen. Welche Arbeit beim Preload tatsächlich auf dem Hauptthread geschieht, wird getrennt gemessen; ein Promise ist keine Garantie für nebenläufige Arbeit. Bei langsamer Antwort bleibt die vorhandene Darstellung am Ziel sichtbar, mit endlicher Fehler-/Abbruchstrategie.

**Prüfung/Abnahme:** Erste tatsächliche Bewegung p95 unter 100ms auf dokumentierten Referenzgeräten; keine wiederholten Frameintervalle über zwei Framebudgets ohne behobene Ursache. Keine Ziel-Mounts/Pipelinekompilierungen während der Bewegung. Warme/kalte Daten und Module getrennt messen. Pose/Anker bleiben beim Handoff stabil; zusätzliche Höhe entsteht ausschließlich in der Inhaltsphase. Reduced Motion ohne künstliche Animationswartezeit.

### 15 — Wiki-fertige Dokumentation mit Bildern abschließen

**Commit:** `docs: explain the layout system with illustrated wiki guides`

- Die während der Umsetzung entstandenen Kapitel in `docs/wiki/` zu einer eigenständig lesbaren Dokumentation zusammenführen. Sprache zunächst Englisch wie die bestehende öffentliche Paketdokumentation; die vorliegende deutsche Entwurfs-/Entscheidungsgrundlage bleibt nachvollziehbar erhalten.
- Fertige Markdown-Dateien, Bilder und ein Exportverzeichnis für das GitHub-Wiki bereitstellen. Nur relative und im Wiki funktionierende Links; kein Laufzeitbedarf an Figma, privaten Repos oder einem Markdown-Buildsystem. Keine Veröffentlichung im Wiki im Rahmen dieses Plans.
- Tatsächliche Screenshots aus der öffentlichen Demo und gezielte beschriftete Raster-/Geometriediagramme verwenden. Jede Abbildung zeigt ein konkretes Prinzip, hat Alttext und Bildunterschrift. Keine verkleinerte Gesamtgrafik als einzige Erklärung.
- Öffentliche APIs, Migration und Architekturreferenzen in `docs/authoring.md`, `docs/api.md`, `docs/theming.md`, `docs/architecture/` und Index abgleichen. Keine zweite, widersprüchliche Spezifikation im Wiki pflegen; Tabellen nach Möglichkeit aus den kanonischen Tokens ableiten.

**Prüfung/Abnahme:** Kapitelumfang und Bildliste aus Abschnitt 5 vollständig; Codebeispiele in der öffentlichen Demo ausführbar; Repo- und Wiki-Links geprüft. Export in einem lokalen Wiki-Checkout/Preview prüfen, ohne ihn zu pushen. Leser können ohne Gesprächskontext ein Layout erstellen und die Entscheidungen nachvollziehen.

### 16 — Gesamtprüfung, Migration und Reviewpaket abschließen

**Commit:** `chore: finalize responsive layout migration and validation`

- Zusammenhängende Prüfläufe in beiden Repos, gepackten Consumer und echte Geräte prüfen. Tests auf den finalen Stand beziehen; bei späteren Änderungen gezielt betroffene Checks wiederholen.
- Migrationsanleitung mit Vorher/Nachher-Beispielen, vollständig entfernte Altpfade und öffentliche Breaking Changes prüfen. Falls bestehende APIs nicht kompatibel abbildbar sind, im Changeset ausdrücklich kennzeichnen; keine Versionsnummer eigenmächtig festlegen.
- Screenshots, gemessene Performance, Geräte/Browser und verbliebene Einschränkungen im Arbeitsprotokoll verknüpfen. Keine absolute Ruckelfreiheitsbehauptung aus Desktopautomation ableiten.
- Reviewbare Commits und zusammengehörige Framework-/Examples-Stände bereitstellen. Veröffentlichung und Merge bleiben außerhalb dieses Arbeitsplans.

**Abnahme:** Alle funktionalen und dokumentarischen Kriterien erfüllt, keine offene grundlegende Layout-/Ownership-/Scrollentscheidung, beide Repos mit reproduzierbarem Testnachweis. Bestehende Inhalte sind migriert oder verfügen über einen explizit dokumentierten kompatiblen Pfad.

## 5. Geplante Wiki-Struktur und Bildkonzept

Die Markdown-Kapitel sollen Regeln, Autorenbeispiele und Entwurfsgründe verbinden. „Warum?“ ist ein fester Bestandteil jedes Kapitels: Lesbarkeit, Wiederverwendung, räumliche Kontinuität, Performance und Eingabeergonomie werden an den jeweiligen Entscheidungen erklärt.

| Vorgesehene Wiki-Seite | Inhalt / Begründung | Geplante Bilder |
| --- | --- | --- |
| `Home.md` | Einstieg, Begriffe, kleinster funktionierender Aufbau, Wegweiser | Übersicht aus öffentlicher Demo |
| `Layout-and-Content-Grid.md` | Viewport vs. Container, sieben/vier Größen, 1536px, Margin/Gutter, explizite Blockspans | Eine Viewport-/Container-Gegenüberstellung; vier beschriftete Raster |
| `Sections-and-Backgrounds.md` | Titel vs. Headline, Padding, Farbfamilien, Full/Standard, Verläufe, Gruppenecken | Background-Matrix; zusammenhängende/unterbrochene Section-Gruppen |
| `Lists-and-Cards.md` | S/M/L, L-in-S-Ausnahme, 1:1/4:3, Typografie/Clamp, kleiner Viewport, Hover | Größenmatrix; Fitbereich mit unverzerrtem Modell/Bild; lange Titel |
| `Detail-Layouts.md` | Hero/Dock/Zoom, Summaryhöhen, Rail, Submenü, Breakpoints | Lesbare Einzelbilder der sieben Layoutgrößen statt Riesentafel |
| `Ultra-Wide-Layout.md` | Mitte +8px, Cap, Dokument-Scroll, Anchorabbildung, linke/rechte Eingabe | Pane unter/über Cap; stationäre und scrollende Regionen; Zoom |
| `Summary-Panels.md` | Default und eigene Snippets, Container Queries, Zustandsbesitz, natürliche Höhe, Overflow | Ein-/zwei-/dreispaltiger Inhalt; Bewegung vs. Inhaltsphase |
| `Media-and-Interaction.md` | 3D/Bild/Video, Minimap, Vollbild, Rail, Maus/Touch/Sensor | Medienwechsel und Interaktionszonen, auch bei ausgeblendeter Pane |
| `Navigation-and-Glass.md` | Menüslots, 112px-Regel, 3XL-Ausnahme, Breadcrumbs, DOM/GPU-Entscheidung | Menü bei vier Scrollpositionen; Matrix geeigneter Oberflächen |
| `Transitions.md` | Gemeinsames Layout, echtes DOM, Datenladen/Bewegung/Bindung/Einblendung, Grenzen | Phasendiagramm mit warmem/kaltem Laden; Hero/Dock/3XL-Ziele |
| `Migration-and-Reference.md` | Bisherige/neue API, vollständige Token-/Breakpointtabellen, Fallbacks, A11y | Nur bei Bedarf gezielte Vorher/Nachher-Abbildung |

Vorgesehener Bildordner: `docs/wiki/images/`. Diagrammquellen separat versionieren, beispielsweise als SVG plus PNG für robuste Wiki-Anzeige. Screenshots verwenden eigene Demo-Geometrien und stabile Viewports, keine privaten Markenassets. Dateinamen, Captions und Alttexte werden mitversioniert. Ein kleines Exportverfahren kopiert Kapitel und Bilder zusammen und passt bei Bedarf Wiki-Seitennamen/Links an; es veröffentlicht nichts.

Die öffentliche Dokumentation beschreibt Regeln als Text, nicht nur als Bild. Jede relevante Entscheidung erhält eine kurze Begründung und gegebenenfalls die bewusst akzeptierte Grenze: etwa natürliche Panelhöhe, sichtbarer Raster-Reflow, 3XL-Dokument-Scrolling und die unterschiedliche Glass-Darstellung über DOM.

## 6. Prüfmatrix und Nachweise

### Repräsentative Grenzen und Zustände

- Breiten: kleine Geräte ab 320px, jede Grenze 600/840/1200/1600/1809/2300 jeweils knapp darunter/auf/darüber; zusätzlich 1536px-Cap, 2456px und ein Ultrawide-Viewport deutlich jenseits des Pane-Caps. Gridtests auch isoliert bei gleicher Viewport-, aber verschiedener Containerbreite.
- Höhen: kurz/typisch/groß, Browserleisten ein-/ausgeblendet, Portrait/Landscape, Browserzoom und vergrößerte Schrift. Geräte-Pixelverhältnis getrennt von CSS-Breiten betrachten.
- Seiten: ContentPage, Liste, Carousel, Detail oben/gescrollt/Zoom, Detail-3XL, Bild/Video. Variabler Inhalt, fehlende optionale Felder, verspätete Fonts/Bilder, Fehler beim Medienladen.
- Navigation: direkte URL/Hash, warmer/kalter Hover-Preload, Klick ohne Hover, Tastatur, Back/Forward, Abbruch/Doppelklick, Layoutwechsel während Bewegung, Header-Kontinuität und Rückkehr zur Katalogauswahl.
- Darstellung: Glass und nicht Glass, Light/Dark, JS an/aus, WebGPU verfügbar/nicht verfügbar, Reduced Motion. Neue native HTML-Struktur muss weiterhin nützlich sein.
- Eingabe: Maus, Trackpad, Touch, Stift/Hybrid. Android und Windows Surface für Sensor/Scroll; iOS/Safari für Berechtigung, Safe Areas und Touch separat prüfen, sobald ein reales Gerät verfügbar ist. Nicht verfügbare Hardwareprüfung im Protokoll offen ausweisen.

Keine blinde vollständige Kreuzprodukt-Suite: reine Formeln an allen Grenzen prüfen; wenige gezielte Browserkombinationen decken die gekoppelten Risiken ab. Screenshots ergänzen Geometrie-/Verhaltensprüfungen, ersetzen sie nicht. Dokumentationscommits brauchen keine vollständigen Runtime-Testläufe.

### Ausführung in den bestehenden Repositories

- Framework: gezielte Vitest-/Playwright-Fälle je Änderung, bei Typ-/Adapteränderung `npm.cmd run check`; zur Integration `npm.cmd test`, `npm.cmd run build:demo`, relevante `npm.cmd run test:e2e` und abschließend `npm.cmd run verify`.
- Examples: mit `npm.cmd run build:local` den aktuellen gepackten Framework-Stand verwenden; anschließend `npm.cmd run check`, `npm.cmd run test:unit` und relevante `npm.cmd run test:e2e`. Paketquellen per `npm.cmd run packages:status` festhalten, damit nicht versehentlich veröffentlichte alte Pakete geprüft werden.
- Performance im Produktionsbuild messen. Pro repräsentativem Transitionsweg mindestens 20 warme und 20 kalte Läufe getrennt; Median, p95, schlechtesten Wert und Frame-/Long-Task-Verlauf ausweisen. Kalte Daten und kalte Module unterscheiden. RAF-Zeiten zusätzlich visuell plausibilisieren, da sie keine GPU-Präsentation beweisen.
- Verifikation bekannter Rechtecke mit maximal 1 CSS-Pixel Rundungsabweichung. Diese Grenze gilt für feste Anker/Boxen; variable Inhaltshöhen werden gegen Flow-/Maximalhöhenregeln geprüft. 3D-Framing/Pose benötigen zusätzliche visuelle Prüfung.

## 7. Arbeitsprotokoll

Ein Schritt gilt erst als fertig, wenn seine Abnahme erfüllt ist. Eintragen: Framework-/Examples-Commit, ausgeführte Prüfungen, Artefaktpfade, Dokumentationsstand und verbleibende Einschränkungen. Bei neuen Erkenntnissen zuerst betroffene Regeln und Tests anpassen; verworfene Annahmen nicht stillschweigend weitertragen.

| Schritt | Status | Framework / Examples / Nachweise |
| --- | --- | --- |
| 01 Spezifikation | abgeschlossen | Framework `159b006`: [Verträge und Entscheidungen](design/layout/README.md), [Prüffälle](design/layout/validation.md); Examples `af85ecd` archiviert 9 Originale und 7 verlustfreie Referenzblätter. Alle SHA-256 und öffentliche Dokumentlinks geprüft. Baseline: 71 Dateien / 369 Unit-Tests bestanden. |
| 02 Resolver | abgeschlossen | Framework `b7a1e0d`: gemeinsame JSON-Tokens, reine Raster-/Detail-/Carousel-/Zoom-Berechnung, natürliche Panel-Constraints und generiertes CSS. 56 gezielte Tests und Core-Typecheck bestanden; CSS-/TS-Tokens per `check:layout` abgesichert. |
| 03 Grid/ContentPage | abgeschlossen | Framework `5092a37`: ContentGrid/ContentBlock, containerabhängige Spans, ContentPage und öffentliche Fixture. Paket-/Demo-Produktionsbuild bestanden; 4 Browserfälle in `content-grid.e2e.ts` bestanden (SSR/noJS, Hydration, 320–3200px, Containergrenzen und Fokusreihenfolge). Scrollbar-Fall anschließend mit `ea33ab0` berücksichtigt. |
| 04 Sections/Theme | abgeschlossen | Framework `3fccbfc`, Examples `b0bb941`: Section-Headline/Background, SSR-Gruppenradien mit separater Präsentationsregistrierung, Theme-Rollen und Seitenfarbe integriert. Beide Section-Browserfälle bestanden (SSR/noJS und Hydration, einschließlich dynamischer Oberfläche); 19 Regel-/Theme-Tests, Paket-/Demo-Build und vollständiger Typecheck bestanden. Bestehende Headlines und Themenfarben explizit migriert. Examples mit lokalen Paketen: Typecheck 0/0, 41 Unit-Tests und Produktionsbuild bestanden. |
| 05 Liste/Karten | abgeschlossen | Framework `9477fa3`: S/M/L-Karten, L-in-S-Ausnahme, Textbudgets, 4:3-Fit und Containerwechsel integriert. 8 Kartenmatrix-/SSR-Browserfälle, 4 Fallback-Textgrößen, Reduced Motion und strenge GPU-Textübergabe bestanden. Letztere deckte gerundete lokale Textoffsets auf: projektive Subpixelkorrektur mit 5 Unit-Fällen; GPU-Handoff bleibt unter 0,5px bei unveränderter Prüfschwelle. Paket-/Demo-Produktionsbuild bestanden. |
| 06 Lebende Panels | abgeschlossen | Framework `473a3a8`: Isolierter dauerhafter Layout-Host unter `/proof/persistent-summary`: 3 Lease-/Phasen-Unit-Tests und 5 Browserfälle auch im Produktionsbuild bestanden. Gleiche echte DOM-Instanz, Werte, Effekte, einmaliger Cleanup, SSR/Hydration, drei Querybreiten und kontrolliert verspäteter Inhalt/Schriftwechsel nachgewiesen. README in der Fixture erläutert die Grenze zu freien externen Fontwechseln; Produktionsintegration folgt in 08/14. |
| 07 Shell/Navigation | abgeschlossen | Framework `742d57c`, Examples `bc28b60`: Dauerhafte Menüs/Satelliten, Breadcrumbs, 112px-Regel, feste 3XL-Ausnahme und DOM-Oberfläche über ContentPages integriert. 10 App-Browserfälle (5 Navigation, 3 Theming, 2 Header-Frameproben Liste/Carousel → Detail), 6 Coretests und 56 native Positionsfälle bestanden; Typechecks 0/0. Demo und drei Brand-Shells migriert. |
| 08 Detail-Hero | abgeschlossen | `416499c`, gemeinsam mit 09: Hero/MediaRail und natürliche Summaryhöhen aus Tokens, persistenter Summary-Host, stabile Viewport-/Safe-Area-Metriken und kanonischer Zoom. 6 Produktionsbrowserfälle bestanden: SSR/Hydration XS–2XL, klassische Scrollbar, kurze/lange Summary und echte GPU-Eventdelegation; 18 Metrik-/Zoom-Unitfälle. Isolierte Besitznachweise `473a3a8` und `128a258` bleiben Grundlage für 14. |
| 09 Dock/Submenü | abgeschlossen | Gemeinsamer Checkpoint mit 08 wegen gemeinsamer Hero-/Dock-CSS-Verträge. 81 fokussierte Coretests und 5 Produktionsbrowserfälle bestanden: kanonische Headergrößen, native/GPU-Tabidentität, Fokus, Hash und Überlauf. [Docking-Vertrag](design/layout/detail-docking.md). |
| 10 Detail-3XL | abgeschlossen | 10a `5d8d789` plus Produktionsintegration: Dokument-Scroll, feste Bühne, Pane-Clipping, Zoom-Ausblendung und Leseposition. 15 fokussierte Coretests und 3 Produktionsbrowserfälle bestanden (NoJS, native Hydration, WebGPU). Strenger Resize-Nachweis hält dasselbe Kapitel bei 3XL → 2XL → 3XL an der jeweiligen Lesekante 182 → 142 → 182px; Eingabeknoten/-wert bleiben erhalten. [Nachweise](design/layout/ultrawide-scroll.md). |
| 11 Medien/Eingabe | abgeschlossen | 3D/Bild/native Videos/YouTube, kontextabhängige 3XL-Eingabe und Rail integriert. 4 Produktionsbrowserfälle bestanden: SSR-Poster, Wiedergabe/Teardown, Fehler, History-Reset, iframe-Lebensdauer und gestopptes Hauptmodell-Rendering. 14 gezielte Eingabe-/Medien-/Metriktests; [Vertrag und Prüfgrenzen](design/layout/media-and-input.md). Physische Geräte und fremde YouTube-Wiedergabe sind durch diese Automation nicht abgedeckt. |
| 12 Carousel | abgeschlossen | Numerisches Framing, intrinsische Summary, kompakte Titelzeile, SSR-Links und persistenter Summary-Slot integriert. 7 Produktionsbrowserfälle über acht Breiten, 1/2/20 Elemente und lebenden Formularzustand bestanden; zusätzlich 18 bestehende Enhancement-/Focus-/Touchfälle. Die Touchfixture enthält explizit nachfolgenden Seiteninhalt, damit vertikales Scrollen tatsächlich prüfbar ist. 38 fokussierte Coretests und Paket-/Demo-Build bestanden. |
| 13 Bestehende Navigation | Navigation und gezielte Folgekorrekturen geprüft | [Regressionsnachweise](design/layout/navigation-regressions.md), Framework `d9349cf`, Examples `6938b45`: öffentliche Historymatrix 6/6, Fokus 7/7, Help 3/3 und private Header grün. Die 60 privaten visuellen Szenarien sind über koordinierte Läufe geprüft: initial 48/60, gezielter Nachlauf 11/13, abschließend 2/2; keine zweite vollständige 60er-Serie. Zusätzlich 21/21 Regressionen und 25/25 einzeln geprüfte Bildbaselines. Historischer Run `6701` auf `8873f41` bleibt 4/6. Nach Tooltip-Selector `d557914` und synchroner Quellsicherung `039b8e2` bestehen dieselben sechs Carousel-/Headerfälle auf Examples-Build `20223` mit 6/6 (Run `16117`). Die zwei zusätzlichen sofortigen Back-Fälle aus Examples `be739a1` stellen dort URL, acht Einträge, Fokus und Historylänge korrekt her, scheiterten auf `039b8e2` aber strikt am separaten Tabs-null-Fehler; beide Fehltraces bleiben archiviert. Lifecyclefix `83ea019`: 7/7 gezielte Units, Sveltecheck 0/0; neuer Nachlauf auf Examples-Build `82285` / Framework-Checkpoint `52c342e` besteht beide FastBack-Fälle (Run `89730`, Exit 0), einschließlich sämtlicher Back/Forward-State-Vergleiche, konstanter Historylänge und leerer pageerrors. Artefakte privat `.artifacts/layout-regression-82285-83ea019-fast-back`; die beiden vorherigen Fehltraces bleiben separat. Fullscreen-Reihenfolge `6e79c9a`: 28/28 gezielte Units und 2/2 Browserfälle auf Demo `39337` (Run `3553`, Exit 0). Fallback-Capture vor Bindung/Bewegung bleibt an vier Projektionspunkten innerhalb 1 CSS-Pixel; nativer Fullscreen-Exit plus Resize lässt das Ziel bedienbar. Artefakte `.artifacts/fullscreen-navigation-39337-83ea019`; genaue Einzelabweichungen wurden vom erfolgreichen Line-Reporter nicht persistiert. Keine neue vollständige 60er-Abnahme. |
| 14a–f Frühe Transition | funktional integriert und geprüft, Opt-in | Teilnachweise unten; vollständige 24/24-Produktionsmatrix auf `83ea019` / `39337`. Nachfolgender Offscreen-Warmup-Stand `960483f`: 3/3 Browserfälle und 978/978 Units bestanden; eigener Nachweis im Warmup-Vertrag. Allgemeine Aktivierung bleibt bis zur erfüllten Performance-Abnahme aus 14f gesperrt. |
| 14a Navigations-Gate | abgeschlossen | `9a85db4`: öffentliche Kit-Integration und Source-Motion-Vertrag. Der native onNavigate-Promise-Hold lässt bei warmer supersedierter Navigation eine veraltete Zielseite mounten; geprüfter cancel/preload/goto-Pfad verhindert dies. 10 Routing- und 4 DOM-/Controller-Browserfälle sowie 39 Unit-Fälle bestanden. |
| 14b Lebende Darstellung | abgeschlossen | Echte Card-/Summary-Inseln, Freeze/Hold/Adopt/Restore und Subpixelprojektion integriert. 18 Produktionsbrowserfälle bestanden: SSR, Cards, echte Komponentenzustände, Cleanup-Besitz, Abbruch, Posterzustand und reaktive Isolation; zusätzlich 7 Carousel-Regressionsfälle. Frühe GPU-Bewegung bleibt separat bis zur Prüfung aller Pipelinevarianten. |
| 14c–e Vorwärtspfade | funktional geprüft auf `83ea019` | Neuer vollständiger gemeinsamer Lauf **24/24** auf Demobuild `39337` / Runtime `83ea019` (Run `98004`, Exit 0), Artefakte `.artifacts/staged-production-39337-83ea019`. Historischer vorheriger Stand: Vollständige **24/24-Produktionsmatrix** auf Demobuild `10039` / Runtime `8873f41` (Fixture `6a2ed1f`), Run `27302`, Exit 0: Liste/Carousel → Hero/Dock/3XL, langsames Laden, Reduced Motion, Fehler, frühe/späte Abbrüche, schnelles Back, echte Summaryidentität und zwei Scene-Cache-Hit-Fälle. Zwölf direkte Projektionsvergleiche halten höchstens 1 CSS-Pixel Abweichung. Artefakte `.artifacts/staged-production-10039-8873f41`, Log daneben. Damit liegt ein gemeinsamer Nachweis einschließlich `2218421`, `8eaf276`, `be72259` und StageDisplay `8873f41` vor. Historische Läufe bleiben erhalten: 22/22 auf 54041 / `362b98a`, zunächst 19/24 auf 2616 / `d92a3b9`, danach die fünf korrigierten Carousel-Fälle plus Escape mit 6/6 auf 5312 / `ebeed3e`; der frühere 19+5-Nachweis wird nicht nachträglich als vollständige Serie bezeichnet. |
| 14f Performance/Aktivierung | offen; weiterhin Opt-in | [Messprotokoll](design/layout/staged-performance.md): Die ursprüngliche 80er-Matrix und alle Folgeproben bleiben erhalten. Neueste isolierte, unprofilierte v2-synthetic-n1-Kohorte auf Demobuild `10026` / Runtime `039b8e2`, Run `59216`, Exit 0: vier Startlatenzfälle und alle zwölf Startgates unter 100ms; DOM 88,2/88,6ms (Liste kalt/warm), 81,5/57,7ms (Carousel kalt/warm). GPU-Erzeugungen von Klick bis Bewegungsende sowie während Reveal überall 0, Validierungsfehler leer. Drei Kalibrierungen sind instabil. Warme Liste besteht die rohen Framegates, ist wegen n1/instabiler Kalibrierung nicht abnahmefähig; warmes Carousel ist stabil kalibriert, hat aber 49,9ms Moving-/50,0ms Reveal-Lücken. Kaltes Carousel hat 50,0ms Moving, kalte Liste 50,1/50,0ms Reveal plus 39,3ms Bewegungsanteil einer Grenzlücke. Keine verworfenen Samples, geänderten Rohgates oder isolierte Verbesserungskausalität. StageDisplay ist enthalten, sein eigener Pacingbeitrag damit nicht bewiesen. Wiederholungs-/Geräteabnahme und allgemeine Aktivierung bleiben offen. |
| 15 Wiki-Dokumentation | abgeschlossen für den Opt-in-Stand | 13 portable Markdown-Dateien, 12 öffentliche Screenshots, 9 SVG/PNG-Diagramme und generierte Tokenreferenz. API, Migration, Changeset und Wiki nennen ausdrücklich `?stagedNavigation=1` sowie die noch offene Performance-Abnahme. Erneute Token-/Linkprüfung und lokaler Export mit SHA-256-Manifest nach `d997b46`: 13 Seiten / 31 Bilddateien gültig, `.artifacts/wiki-export`; nichts veröffentlicht. Sieben Svelte-Beispiele und lokale Vorschau bereits geprüft. Bei späterer allgemeiner Aktivierung müssen diese Hinweise und der Export gemeinsam aktualisiert werden. |
| 16 Gesamtprüfung | Software-/Paketnachweise geprüft; Performance/Geräte und allgemeine Aktivierung offen | Aktueller Framework-Checkpoint `52c342e` mit Runtimekorrekturen `83ea019` und `6e79c9a`: **936/936 Units in 119 Dateien** (Run `46764`, Exit 0), alle Workspace-Typechecks **0/0** (Run `97989`, Exit 0), Paketbuild `67527`, Demobuild `39337` und Examples-Build `82285` erfolgreich. Neue vollständige Produktionsmatrix **24/24 gemeinsam** auf `39337` / `83ea019` (Run `98004`, Exit 0), Artefakte `.artifacts/staged-production-39337-83ea019`. Neue private FastBack-Nachtests 2/2 auf diesem Host (Run `89730`, Exit 0), einschließlich aller History-Roundtrips und leerer pageerrors. Die sechs gewöhnlichen Carousel-/Headerfälle bleiben separat mit 6/6 auf Examples `20223` / Runtime `039b8e2` belegt. Historischer Stand `8873f41`: 914/914 Units, vollständige 24/24-Produktionsmatrix und GPU-Pixelproof mit 24 exakten Vergleichen; dieser historische Lauf bleibt vom neuen vollständigen 24er-Lauf getrennt. Fullscreen-Browserfälle auf Demo `39337`: 2/2, Run `3553`, Exit 0 (Fallback-Pose ≤1 CSS-Pixel, nativer Exit/Resize/erneute Navigation bedienbar). Isolierter Tarball-Consumer `76173`, Exit 0: 460 Core-/118 Svelte-Allowlistdateien, unabhängige Installation in `spatial-elements-consumer-be4kMc`, automatisch installiertes Three-Peer, Coreimport ohne DOM/GPU, Sveltecheck 0/0 und SSR-Produktionsbuild. Offline npm/Workspacecache nach archiviertem Globalcache-EPERM (`94814`) und abgebrochenem Netzwerk-EACCES-Retry (`60801`); Erfolgslog `.artifacts/layout-history-fixes-package-consumer-offline.log`. Geprüfte Bytes: Svelte-Runtime `83ea019`/Core `8873f41`, Quellencheckpoint `52c342e`, keine spätere Warmup-WIP. Release-Metadaten, sechs Release-Tests, Boundaries, Layoutgenerator und Wiki 13/31 ebenfalls grün (`92806`, Exit 0). Älterer Release-/Boundary-/Tarball-Nachweis bleibt `f7cef21` zugeordnet (`.artifacts/final-verify.log`, `.artifacts/final-package-verify-network.log`). Zehn bereits vorher quellenlose Zeichnungseinträge sind mit kompatiblem unavailable-Fallback dokumentiert. Physische Android-/iOS-/Surface-Prüfung und Performance14f bleiben offen. Nachfolgender Offscreen-Warmup-Commit `960483f`: 76 gezielte Units und Typechecks grün, Paketbuild `64997` und Demobuild `11873` erfolgreich. Vollständige Units: 978/978 in 123 Dateien (Run `81639`, Exit 0). Drei neue Browserfälle auf `11873` (Run `56431`, Exit 0) belegen zehn exakte Screenshotpaare, lineare/Tiefen-Gleichheit, keine Ressourcen beim ersten Scroll und echte List-/Carousel-Nutzung samt Zoom. [Warmup-Nachweis](design/layout/deferred-scroll-warmup.md). Die vorherigen 24er-/Tarball-/Examples-Vollnachweise gelten weiterhin ausschließlich für den `83ea019`-Checkpoint. |

### Aktueller Messcheckpoint

Die vollständige gemeinsame Produktionsmatrix ist zusätzlich auf Demo `91647`
mit Runtime `960483f` bestanden: **24/24**, Run `17707`, Exit 0, Artefakte
`.artifacts/staged-production-91647-960483f`. Sie umfasst beide Scene-Cache-Hits,
Liste/Carousel → Hero/Dock/3XL, langsame Antworten, Reduced Motion, Quelle-/Ziel-
Abbruch, schnelles Back und Fehlerfall. Dieser Build enthält den geprüften
Offscreen-Scroll-Warmup, aber noch keinen optionalen CatalogWarmOutputContext.

Der isolierte n1-Lauf auf Demo `11873` / Runtime `960483f` (Run `76630`, Exit 0)
erfüllt erneut alle zwölf Startgates: DOM-Reaktion 64,7/41,5ms für Liste kalt/warm
und 55,5/38,4ms für Carousel kalt/warm. Bewegungs-/Reveal-Framegates bleiben offen,
unter anderem mit 66,6ms in kalter Liste und 50,0ms im kalten Carousel. Zwei
Kalibrierungen sind stabil, zwei instabil. Keine verworfenen Samples; keine
allgemeine Aktivierung oder isolierte Verbesserungsbehauptung. Die genaue
Abgrenzung und Artefakte stehen im [Messprotokoll](design/layout/staged-performance.md).

### Prüfgrenze der jüngsten Folgekorrekturen

- `2218421`: Der [Paint-Vertrag](design/layout/staged-cleanup-paint.md) ist mit zwei echten Summary-/Hero-/Dock-Browserfällen auf Build `70245` / `8eaf276` nachgewiesen; Identität und Formularwert bleiben vor und nach Cleanup erhalten. Reveal-Endmarker und Rohgates bleiben unverändert.
- `8eaf276`: Die [Aktivierungsfokus-Koaleszierung](design/layout/catalog-activation-focus.md) besteht auf demselben Build alle sechs separaten Browserfälle. Nativer Fokus, DOM-Veto, gewöhnliche Navigation und direkte Tastatur-/Pointerpfade sind geprüft. Dies ist kein Geschwindigkeitsnachweis.
- `be72259`: Die [unterdrückte unveränderte Readiness-Benachrichtigung](design/layout/catalog-preparation-notifications.md) entfernt im isolierten Vorher-/Nachher-Trace den zusätzlichen Source-RAF; auf Build `36109` entstehen vor Adaptereintritt 0 Submits und 0 GPU-Ressourcen. Die vier unprofilierten n1-Samples bleiben davon getrennt.
- `8873f41`: [StageDisplay-Clear](design/layout/stage-display-clear.md), dokumentiert in `13be2b4`: Auf Build `10039` / Fixture `6a2ed1f` sind alle 24 linearen HalfFloat- und finalen Canvas-Vergleiche exakt, ohne GPU-Validierungsfehler. Zwölf Standardfälle benötigen 2 statt 4 Submits, zwölf Fallbacks unverändert 4. Der erste fehlerhafte Resize-Fixture-Lauf bleibt erhalten. Die gemeinsame 24er-Funktionsmatrix ist grün. Die spätere n1-Kohorte auf `039b8e2` enthält diesen Pfad, isoliert aber keine Pacingwirkung dieser einzelnen Änderung.

Die [Cleanup-/Zoom-Auswertung](../.artifacts/staged-gpu-trace-36109-be72259-carousel-cold/cleanup-zoom-audit.md) trennt den profilierten 69,006ms-Cleanup-RAF vom späteren 173,503ms-Zoom-Warmup. Diese Anschlusslast verschwindet nicht durch die unveränderten Reveal-Grenzen. Ältere Rohfails, instabile Kalibrierungen und abgelehnte Einstiege bleiben erhalten. Die Software-/Paketnachweise gelten für die genannten gebauten Revisionen, nicht für nachfolgende Warmup-Experimente. Nächste Abnahmegrenzen sind tatsächliches Pacing, die geforderten Wiederholungsmatrizen und physische Geräte; keine allgemeine Aktivierung aus Funktions-, Pixel-, n1- oder Profilerergebnissen.
