// ============================================================
// USERS ROUTES — Profil et dashboard utilisateur
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1/users
// ============================================================
// IMPORTANT : Les routes /admin/users/* sont dans admin.routes.js
// Ce fichier ne contient QUE les routes de l'utilisateur connecté.
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./users.controller');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Profil et dashboard de l'utilisateur connecté
 */

// ============================================================
// PROFIL — UC7
// ============================================================

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: UC7 — Profil complet de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Profil utilisateur avec compteurs }
 *       401: { description: Non authentifié }
 */
router.get('/users/me', authenticate, controller.getProfile.bind(controller));

/**
 * @swagger
 * /users/me:
 *   put:
 *     tags: [Users]
 *     summary: UC7 — Mettre à jour son profil
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string, example: "Alice Ouédraogo" }
 *               email:       { type: string, example: "alice@example.com" }
 *               city:        { type: string, example: "Bobo-Dioulasso" }
 *               addressLine: { type: string, example: "Secteur 12, Rue 14" }
 *               avatarUrl:   { type: string }
 *               notifEmail:  { type: boolean }
 *               notifSMS:    { type: boolean }
 *               notifPush:   { type: boolean }
 *     responses:
 *       200: { description: Profil mis à jour }
 *       409: { description: Email déjà utilisé }
 */
router.put(
  '/users/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Nom trop court'),
    body('email').optional().isEmail().withMessage('Email invalide'),
    body('city').optional().trim(),
    body('addressLine').optional().trim(),
    body('notifEmail').optional().isBoolean(),
    body('notifSMS').optional().isBoolean(),
    body('notifPush').optional().isBoolean(),
  ],
  validate,
  controller.updateProfile.bind(controller),
);

/**
 * @swagger
 * /users/me:
 *   delete:
 *     tags: [Users]
 *     summary: Supprimer son compte (RGPD)
 *     description: Anonymise les données personnelles. Impossible si dans un groupe actif.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Compte anonymisé et supprimé }
 *       409: { description: Impossible — groupe actif en cours }
 */
router.delete('/users/me', authenticate, controller.deleteAccount.bind(controller));

// ============================================================
// DASHBOARD — UC10, UC11
// ============================================================

/**
 * @swagger
 * /users/me/groups:
 *   get:
 *     tags: [Users]
 *     summary: UC10 — Dashboard "Mes Groupes" (actifs + terminés)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Groupes actifs et historique groupes terminés }
 */
router.get('/users/me/groups', authenticate, controller.getMyGroups.bind(controller));

/**
 * @swagger
 * /users/me/history:
 *   get:
 *     tags: [Users]
 *     summary: UC11 — Historique des achats et paiements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Historique paginé des participations et paiements }
 */
router.get('/users/me/history', authenticate, controller.getHistory.bind(controller));

// ============================================================
// NOTIFICATIONS — UC12
// ============================================================

/**
 * @swagger
 * /users/me/notifications:
 *   get:
 *     tags: [Users]
 *     summary: UC12 — Mes notifications avec compteur non lues
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Notifications paginées + compteur non lues }
 */
router.get('/users/me/notifications', authenticate, controller.getMyNotifications.bind(controller));

/**
 * @swagger
 * /users/me/notifications/{id}/read:
 *   patch:
 *     tags: [Users]
 *     summary: UC12 — Marquer une notification comme lue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification marquée comme lue }
 */
router.patch(
  '/users/me/notifications/:id/read',
  authenticate,
  controller.markNotificationRead.bind(controller),
);

/**
 * @swagger
 * /users/me/notifications/read-all:
 *   patch:
 *     tags: [Users]
 *     summary: UC12 — Marquer toutes les notifications comme lues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Toutes notifications marquées comme lues }
 */
router.patch(
  '/users/me/notifications/read-all',
  authenticate,
  controller.markAllNotificationsRead.bind(controller),
);

module.exports = router;