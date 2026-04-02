import axios from "axios";

export async function getJiraCloudId(accessToken) {
  try {
    const response = await axios.get("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    return response.data[0]?.id;
  } catch (err) {
    if (err.response?.status === 401) {
      console.warn("Jira API returned 401 for Cloud ID. Body:", JSON.stringify(err.response.data));
      throw new Error("401");
    }
    console.error("Failed to fetch Jira Cloud ID:", err.message);
    return null;
  }
}

export async function fetchJiraBoards(accessToken, cloudId) {
  try {
    const response = await axios.get(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0/board`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );
    return response.data.values || [];
  } catch (err) {
    if (err.response?.status === 401) throw new Error("401");
    console.error("Failed to fetch Jira Boards:", err.message);
    return [];
  }
}

export async function fetchActiveJiraTasks(accessToken, cloudId, filterBoardIds = null) {
  try {
    let boards = await fetchJiraBoards(accessToken, cloudId);
    console.log(`Initial API fetch found ${boards.length} Jira Software Boards.`);

    let targetBoards = [];
    if (filterBoardIds !== null) {
      if (filterBoardIds.length === 0) {
        console.log("No linked Jira boards specified, returning empty tasks.");
        return [];
      }
      // Map external db ids closely (toString)
      targetBoards = boards.filter(b => filterBoardIds.includes(b.id.toString()));
      console.log(`Matched ${targetBoards.length} actual boards to DB links.`);
    } else {
      targetBoards = boards;
    }

    let projectKeys = [];
    for (const board of targetBoards) {
      // The base board API exposes the underlying projectKey automatically in its location block!
      if (board.location && (board.location.projectKey || board.location.projectName)) {
        projectKeys.push(board.location.projectKey || board.location.projectName);
      } else {
        console.warn(`Board ${board.id} does not have a native project mapping in board tree.`);
      }
    }

    const uniqueProjectKeys = [...new Set(projectKeys)];
    console.log(`JIRA Board Context identified project keys: [${uniqueProjectKeys.join(", ")}]`);

    let allIssues = [];
    if (uniqueProjectKeys.length > 0) {
      // Step 2: Use standard Jira Platform API search to grab issues
      // Requires read:jira-work which we have, totally bypassing Agile permissions!
      const jql = encodeURIComponent(`project IN (${uniqueProjectKeys.join(",")}) order by updated DESC`);
      const searchResp = await axios.get(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=key,summary,description,status,assignee,updated`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      allIssues = searchResp.data.issues || [];
      console.log(`Fetched ${allIssues.length} issues using global project keys for Jira Boards.`);
    }

    // Deduplicate issues by key
    const uniqueIssuesMap = new Map();
    for (const issue of allIssues) {
      uniqueIssuesMap.set(issue.key, issue);
    }

    const uniqueIssues = Array.from(uniqueIssuesMap.values());
    console.log("ISSUES : ", JSON.stringify(uniqueIssues, null, 2))
    console.log(`JIRA Search API Success: Found ${uniqueIssues.length} total unique issues for the board context.`);

    const keysFound = uniqueIssues.map(i => i.key);
    console.log("JIRA Ground Truth Keys:", keysFound.join(", "));

    return uniqueIssues;
  } catch (err) {
    if (err.response?.status === 401) {
      console.warn("Jira API returned 401 during Board/Project Search. Body:", JSON.stringify(err.response.data));
      throw new Error("401");
    }
    console.error("Failed to fetch Jira tasks for projects:", err.message);
    return [];
  }
}

export async function refreshJiraToken(integration) {
  try {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!clientId || !clientSecret || !integration.refreshToken) {
      throw new Error("Missing JIRA_CLIENT_ID/SECRET or Refresh Token");
    }

    const response = await axios.post("https://auth.atlassian.com/oauth/token", {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refreshToken,
    });

    const { access_token, refresh_token } = response.data;

    console.log("Jira Refresh Successful. New token starts with:", access_token.substring(0, 10));

    integration.accessToken = access_token;
    if (refresh_token) {
      integration.refreshToken = refresh_token;
    }
    await integration.save();

    return access_token;
  } catch (err) {
    console.error("Critical: Jira token refresh failed:", JSON.stringify(err.response?.data || err.message));
    throw err;
  }
}
