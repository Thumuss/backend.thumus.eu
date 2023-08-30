import { Router } from "express"

const router = Router();

router.get("/err", (req, res) => {
  res.render("err");
});
module.exports = router;
