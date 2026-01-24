import { Router } from 'express';
import { GroupsController } from './groups.controller';
import { GroupsValidation } from './groups.validation';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/groups:
 *   post:
 *     tags: [Groups]
 *     summary: Créer un nouveau groupe d'achat
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - name
 *               - minParticipants
 *               - maxParticipants
 *               - endDate
 *               - discountCurve
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *               minParticipants:
 *                 type: number
 *                 minimum: 2
 *               maxParticipants:
 *                 type: number
 *                 minimum: 5
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               discountCurve:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     participants:
 *                       type: number
 *                     discountPercent:
 *                       type: number
 *     responses:
 *       201:
 *         description: Groupe créé
 */
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['SUPPLIER', 'ADMIN']),
  GroupsValidation.validateCreateGroup,
  GroupsController.createGroup
);

/**
 * @swagger
 * /api/v1/groups:
 *   get:
 *     tags: [Groups]
 *     summary: Obtenir tous les groupes d'achat
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, CLOSED, COMPLETED, FAILED, CANCELLED]
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *     responses:
 *       200:
 *         description: Liste des groupes
 */
router.get(
  '/',
  GroupsController.getAllGroups
);

/**
 * @swagger
 * /api/v1/groups/my/groups:
 *   get:
 *     tags: [Groups]
 *     summary: Obtenir mes groupes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, all]
 *     responses:
 *       200:
 *         description: Mes groupes
 */
router.get(
  '/my/groups',
  authMiddleware,
  GroupsController.getMyGroups
);

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   get:
 *     tags: [Groups]
 *     summary: Obtenir un groupe par ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails du groupe
 */
router.get(
  '/:id',
  GroupsController.getGroupById
);

/**
 * @swagger
 * /api/v1/groups/{id}/join:
 *   post:
 *     tags: [Groups]
 *     summary: Rejoindre un groupe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [ORANGE_MONEY, MOOV_MONEY, LIGDICASH, CARD]
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Groupe rejoint avec succès
 */
router.post(
  '/:id/join',
  authMiddleware,
  GroupsValidation.validateJoinGroup,
  GroupsController.joinGroup
);

/**
 * @swagger
 * /api/v1/groups/{id}/leave:
 *   post:
 *     tags: [Groups]
 *     summary: Quitter un groupe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Groupe quitté avec succès
 */
router.post(
  '/:id/leave',
  authMiddleware,
  GroupsController.leaveGroup
);

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   patch:
 *     tags: [Groups]
 *     summary: Mettre à jour un groupe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Groupe mis à jour
 */
router.patch(
  '/:id',
  authMiddleware,
  roleMiddleware(['SUPPLIER', 'ADMIN']),
  GroupsValidation.validateUpdateGroup,
  GroupsController.updateGroup
);

export default router;