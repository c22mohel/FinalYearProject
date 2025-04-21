// routes/summary.js
module.exports = function (db) {
    return async (req, res) => {
      try {
        const result = await db.query(`
          SELECT 
            COUNT(*) FILTER (WHERE det_distraction = true) AS distracted,
            COUNT(*) FILTER (WHERE det_smoking = true) AS smoking,
            COUNT(*) FILTER (WHERE det_eating = true) AS eating,
            COUNT(*) FILTER (WHERE det_drinking = true) AS drinking,
            COUNT(*) FILTER (WHERE det_phoning = true) AS phoning,
            COUNT(*) FILTER (WHERE det_eyes_on_road = true) AS eyes_on_road,
            COUNT(*) AS total
          FROM smarteye_expanded
        `);
  
        const { distracted, smoking, eating, drinking, phoning, eyes_on_road, total } = result.rows[0];
        const distractionPct = total > 0 ? (distracted / total) * 100 : 0;
        const smokingPct = total > 0 ? (smoking / total) * 100 : 0;
        const eatingPct = total > 0 ? (eating / total) * 100 : 0;
        const drinkingPct = total > 0 ? (drinking / total) * 100 : 0;
        const phoningPct = total > 0 ? (phoning / total) * 100 : 0;
        const eyesOnRoadPct = total > 0 ? (eyes_on_road / total) * 100 : 0;

        res.json({ 
          distraction: distractionPct.toFixed(1),
          smoking: smokingPct.toFixed(1),
          eating: eatingPct.toFixed(1),
          drinking: drinkingPct.toFixed(1),
          phoning: phoningPct.toFixed(1),
          eyes_on_road: eyesOnRoadPct.toFixed(1),
          total
        });

      } catch (err) {
        console.error('Error in /summary:', err.message);
        res.status(500).send('Internal Server Error');
      }
    };
  };
  