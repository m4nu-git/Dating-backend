import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getUpload } from "../config/s3.config";
import { asyncHandler } from "../utils/async.handler";
import * as userController from "../controllers/user.controller";

const router = Router();

// Public
router.post("/login",        asyncHandler(userController.login));
router.post("/googleLogin",  asyncHandler(userController.googleLogin));
router.post("/register",     (req, res, next) => getUpload().array("images")(req, res, next), asyncHandler(userController.register));

// Protected
router.post("/imageLiked",     authMiddleware, asyncHandler(userController.likeImage));
router.post("/behaviourLiked", authMiddleware, asyncHandler(userController.likeBehaviour));
router.post("/reject",         authMiddleware, asyncHandler(userController.reject));
router.post("/accept",         authMiddleware, asyncHandler(userController.accept));

router.get("/allLikes",        authMiddleware, asyncHandler(userController.getAllLikes));
router.get("/allMatches",      authMiddleware, asyncHandler(userController.getAllMatches));
router.get("/matches",         authMiddleware, asyncHandler(userController.getMatches));
router.get("/me",              authMiddleware, asyncHandler(userController.getMe));
router.get("/profile/:id",     authMiddleware, asyncHandler(userController.getProfile));
router.get("/chats/:id",       authMiddleware, asyncHandler(userController.getChats));

export default router;
