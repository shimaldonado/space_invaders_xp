# Space Invaders XP - Dashboard Metodológico

Dashboard web desarrollado para gestionar y visualizar el avance metodológico del proyecto **Space Invaders XP**, aplicando prácticas de **Extreme Programming (XP)** y relacionando información de historias de usuario, iteraciones, pruebas, bugs, roles, trazabilidad y métricas del proyecto.

## Descripción del proyecto

Este dashboard permite organizar y controlar el avance del proyecto académico **Space Invaders XP**, mostrando información relacionada con:

- Historias de usuario.
- Iteraciones del proyecto.
- Roles XP del equipo.
- Métricas de avance.
- Pruebas registradas en TestRail.
- Actividades y bugs registrados en Jira.
- Trazabilidad entre historias, criterios, pruebas y tareas.
- Línea de tiempo de entregas.
- Cambios, commits, evidencias y artefactos del proyecto.

El objetivo principal es tener una vista centralizada del estado del proyecto, permitiendo registrar avances, revisar tareas finalizadas, analizar métricas y mantener evidencia del trabajo realizado durante las iteraciones.

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript
- Node.js
- Servidor local con JavaScript
- Archivo JSON para persistencia de datos

## Funcionalidades principales

### Dashboard general

Muestra un resumen del proyecto con métricas principales como:

- Total de historias de usuario.
- Total de pruebas.
- Bugs registrados.
- Velocidad del equipo.
- Avance ponderado del proyecto.
- Estado general de iteraciones.

### Gestión de historias de usuario

Permite visualizar y modificar historias de usuario relacionadas con el proyecto.

Cada historia puede tener información como:

- Código de HU.
- Nombre.
- Iteración.
- Estado.
- Responsable.
- Puntos.
- Criterios de aceptación.
- Relación con pruebas y tareas.

### Estados de trabajo

El dashboard maneja estados similares a los usados en Jira:

- Por hacer.
- En curso.
- En revisión.
- Finalizado.
- Reabierta.
- Retrabajo.

Esto permite representar el flujo real de trabajo del equipo y también volver a abrir historias cuando necesitan correcciones.

### Métricas dinámicas

Las métricas se recalculan de acuerdo con los cambios realizados dentro del dashboard.

Por ejemplo, si una historia cambia de **En revisión** a **Finalizado**, se actualizan:

- Avance general.
- Avance por iteración.
- Puntos finalizados.
- Progreso por persona.
- Estado del tablero.
- Línea de tiempo.
- Trazabilidad relacionada.

### Persistencia de datos

Los cambios realizados dentro del dashboard pueden guardarse usando el botón:


Dashboard web para el seguimiento metodológico del proyecto Space Invaders XP, integrando historias de usuario, iteraciones, métricas, pruebas TestRail, bugs Jira y trazabilidad bajo la metodología Extreme Programming.

```txt
Guardar cambios
