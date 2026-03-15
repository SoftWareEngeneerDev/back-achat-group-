const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./users.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestion des profils et administration des utilisateurs
 */

/**
 * @swagger
 * /me:
 *   get:
 *     tags: [Users]
 *     summary: Récupérer le profil de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 */
// Routes utilisateur connecté
router.get('/me', authenticate, controller.getProfile.bind(controller));

/**
 * @swagger
 * /me:
 *   put:
 *     tags: [Users]
 *     summary: Mettre à jour le profil de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Alice Ouedraogo" }
 *               email: { type: string, format: email, example: "alice@example.com" }
 *               city: { type: string, example: "Bobo-Dioulasso" }
 *     responses:
 *       200:
 *         description: Profil mis à jour
 */
router.put('/me', authenticate, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('city').optional().trim(),
], validate, controller.updateProfile.bind(controller));

/**
 * @swagger
 * /me:
 *   delete:
 *     tags: [Users]
 *     summary: Supprimer le compte de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compte supprimé avec succès
 */
router.delete('/me', authenticate, controller.deleteAccount.bind(controller));

/**
 * @swagger
 * /me/groups:
 *   get:
 *     tags: [Users]
 *     summary: Liste des groupes rejoints par l'utilisateur
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des groupes
 */
router.get('/me/groups', authenticate, controller.getMyGroups.bind(controller));

/**
 * @swagger
 * /me/history:
 *   get:
 *     tags: [Users]
 *     summary: Historique d'activités/commandes de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historique
 */
router.get('/me/history', authenticate, controller.getHistory.bind(controller));

// Routes admin

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Users]
 *     summary: Liste de tous les utilisateurs (Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 */
router.get('/admin/users', authenticate, requireAdmin, controller.listUsers.bind(controller));

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Modifier le statut d'un utilisateur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: 
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, BANNED]
 *     responses:
 *       200:
 *         description: Statut mis à jour
 */
router.patch('/admin/users/:id/status', authenticate, requireAdmin, [
  body('status').isIn(['ACTIVE', 'SUSPENDED', 'BANNED']),
], validate, controller.updateUserStatus.bind(controller));

/**
 * @swagger
 * /admin/users/{id}/role:
 *   put:
 *     tags: [Users]
 *     summary: Modifier le rôle d'un utilisateur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [MEMBER, SUPPLIER, GROUP_LEADER, ADMIN]
 *     responses:
 *       200:
 *         description: Rôle mis à jour
 */
router.put('/admin/users/:id/role', authenticate, requireAdmin, [
  body('role').isIn(['MEMBER', 'SUPPLIER', 'GROUP_LEADER', 'ADMIN']),
], validate, controller.updateUserRole.bind(controller));

module.exports = router;
