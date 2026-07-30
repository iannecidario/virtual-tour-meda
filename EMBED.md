# Incorporare il Virtual Tour MEdA

Usare l'indirizzo pubblico in modalita embed:

`https://iannecidario.github.io/virtual-tour-meda/?embed=1`

## Codice responsive completo

```html
<div class="meda-tour-embed">
  <iframe
    src="https://iannecidario.github.io/virtual-tour-meda/?embed=1"
    title="Virtual Tour del Museo Etnografico di Aquilonia"
    loading="lazy"
    allow="fullscreen; autoplay"
    allowfullscreen
    referrerpolicy="strict-origin-when-cross-origin">
  </iframe>
</div>

<style>
  .meda-tour-embed {
    position: relative;
    width: 100%;
    height: min(80vh, 800px);
    min-height: 500px;
    overflow: hidden;
    background: #000;
  }

  .meda-tour-embed iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }

  @media (max-width: 600px) {
    .meda-tour-embed {
      height: 75vh;
      min-height: 420px;
    }
  }

  @media (orientation: landscape) and (max-height: 500px) {
    .meda-tour-embed {
      height: 100vh;
      min-height: 0;
    }
  }
</style>
```

## Versione iframe essenziale

Per piattaforme che non accettano il tag `<style>`:

```html
<iframe
  src="https://iannecidario.github.io/virtual-tour-meda/?embed=1"
  title="Virtual Tour del Museo Etnografico di Aquilonia"
  width="100%"
  height="700"
  style="display:block; border:0; max-width:100%;"
  loading="lazy"
  allow="fullscreen; autoplay"
  allowfullscreen>
</iframe>
```

## Personalizzazione dimensioni

- Per un riquadro piu alto su desktop aumentare `height` o `min-height` in `.meda-tour-embed`.
- Su smartphone e preferibile usare valori in `vh`, cosi il tour resta proporzionato allo schermo.
- Evitare altezze troppo basse: sotto i 420 pixel i controlli e il pannello informativo diventano meno comodi.

## Audio e fullscreen

- L'attributo `allow="fullscreen; autoplay"` e necessario per autorizzare fullscreen e audio dentro l'iframe.
- Safari, Chrome, Firefox e i browser mobili possono comunque bloccare audio udibile finche l'utente non compie un gesto volontario.
- Il pulsante `Inizia la visita` dell'overlay iniziale viene usato come interazione esplicita per abilitare l'audio quando possibile.
- Se il browser blocca comunque una riproduzione prevista dal tour, viene mostrato un comando discreto `Attiva audio`.
- Se il fullscreen nativo non e disponibile dentro l'iframe, il tour mostra il collegamento `Apri il tour a pagina intera`.

## Apertura a pagina intera

Link diretto:

`https://iannecidario.github.io/virtual-tour-meda/`
