# Dashboard XP Space Invaders · Jira + TestRail ajustado

## Qué se corrigió en esta versión

Esta versión fue reajustada con los datos del archivo **Jira (3).csv** y con los resultados visibles de **TestRail TR-01, TR-02 y TR-03**.

- Jira queda con **138 actividades**: 78 finalizadas, 45 en revisión, 14 en curso y 1 por hacer.
- La carga del equipo queda alineada con el panel de Jira: Kevin 20%, David 18%, Diego 18%, Shirley Maldonado 18%, Anna 13% y Nahomy 13%.
- Iteración 2 ya no aparece como “sin avance”: se calcula con avance ponderado porque tiene muchas actividades en revisión y en curso.
- Los puntos finalizados se muestran separados del avance real: **Finalizado = 100%**, **En revisión = 80%**, **En curso = 50%**, **Por hacer = 0%**.
- TestRail queda enlazado por iteración: TR-01 83%, TR-02 50% y TR-03 67% passed.

## Opción recomendada: abrir con guardado persistente

1. Descomprime el ZIP.
2. Abre la carpeta en VS Code.
3. Abre una terminal dentro de esta carpeta.
4. Ejecuta:

```bash
npm start
```

5. Abre en el navegador:

```text
http://localhost:3000
```

Cuando cambies una HU/tarea a **Finalizado**, **En revisión**, **En curso** o **Por hacer**, se guarda en `data/state.json`. Aunque cierres el navegador o detengas Node.js, al volver a ejecutar `npm start` los cambios se mantienen.

## Para entrar desde otra computadora

1. La computadora principal debe estar encendida y ejecutando `npm start`.
2. Ambas computadoras deben estar en la misma red Wi-Fi o LAN.
3. En la computadora principal, mira tu IP con:

```powershell
ipconfig
```

4. En la otra computadora abre:

```text
http://IP-DE-TU-COMPUTADORA:3000
```

Ejemplo:

```text
http://192.168.1.20:3000
```

Si no abre, revisa que el Firewall de Windows permita Node.js o el puerto 3000.

## Botones importantes

- **Guardar cambios**: guarda el estado actual en el servidor.
- **Exportar JSON**: sirve para llevar una copia del estado a otra computadora.
- **Importar JSON**: restaura un estado exportado.
- **Restaurar base**: vuelve a los datos base de Jira/TestRail incluidos en el ZIP.

## Nota

Puedes abrir `index.html` directamente o con Live Server, pero ahí el guardado queda solo en el navegador. Para que los cambios se conserven y puedan verse desde otra computadora, usa siempre `npm start`.
