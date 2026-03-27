import DB from "../../database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateTokenResponse } from "../../middlewares/auth";

const SignUp = async (req, res) => {
  try {
    const { email, password, firstName, lastName, workspaceName, membersCount, token, ...extraFields } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: "firstName, lastName, email, and password are required" });
    }

    if (!token && !workspaceName) {
      return res.status(400).json({ message: "Workspace name or valid Invite Token is required" });
    }

    // Check if user exists
    let user = await DB.users.findOne({ where: { email } });
    if (user) {
      if (token) {
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: "Email already exists. Incorrect password." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const existingMember = await DB.members.findOne({ 
          where: { userId: user.id, workspaceId: decoded.workspaceId } 
        });

        if (!existingMember) {
          await DB.members.create({
            userId: user.id,
            workspaceId: decoded.workspaceId,
            role: decoded.role || "member"
          });
        }

        const authToken = generateTokenResponse(user);

        return res.status(200).json({
          token: authToken.token,
          user: user.toJSON(),
          workspace: {
            id: decoded.workspaceId,
            name: decoded.workspaceName || "Joined Workspace", // Usually decoded has this if I added it? Wait.
            role: decoded.role || "member"
          }
        });
      } else {
        return res.status(400).json({ message: "email already exists" });
      }
    }

    const userPassword = bcrypt.hashSync(password, 10);
    const transaction = await DB.sequelize.transaction();

    try {
      user = await DB.users.create({
        firstName,
        lastName,
        email,
        password: userPassword,
      }, { transaction });

      // Join Mode
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await DB.members.create({
          userId: user.id,
          workspaceId: decoded.workspaceId,
          role: decoded.role || "member"
        }, { transaction });

      // Creation Mode
      } else {
        const workspace = await DB.workspaces.create({
          name: workspaceName,
          membersCount: membersCount || "1-10",
          userId: user.id
        }, { transaction });

        await DB.members.create({
          userId: user.id,
          workspaceId: workspace.id,
          role: "owner"
        }, { transaction });
      }

      await transaction.commit();

      const authToken = generateTokenResponse(user);

      // Fetch the created/joined workspace to return it
      const membership = await DB.members.findOne({
        where: { userId: user.id },
        include: [{ model: DB.workspaces, as: "workspace" }],
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        token: authToken.token,
        user: user.toJSON(),
        workspace: membership?.workspace ? {
          id: membership.workspace.id,
          name: membership.workspace.name,
          role: membership.role,
          membersCount: membership.workspace.membersCount,
          userId: membership.workspace.userId
        } : null
      });
    } catch (dbErr) {
      await transaction.rollback();
      throw dbErr;
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default SignUp;
