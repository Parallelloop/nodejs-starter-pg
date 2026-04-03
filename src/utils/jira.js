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

export async function getConfluenceCloudId(accessToken) {
  try {
    const response = await axios.get("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    console.log("Confluence Accessible Resources:", JSON.stringify(response.data, null, 2));
    // Find a resource that has confluence scopes
    const confResource = response.data.find(r => r.scopes.some(s => s.includes("confluence")));
    if (confResource) {
      console.log("Found explicitly Confluence Cloud ID:", confResource.id);
      return confResource.id;
    }
    return response.data[0]?.id;
  } catch (err) {
    console.error("Failed to fetch Confluence Cloud ID:", err.message);
    return null;
  }
}

export async function fetchConfluenceSpaces(accessToken, cloudId) {
  try {
    let url = `https://api.atlassian.com/ex/confluence/${cloudId}/rest/api/search?cql=${encodeURIComponent('type=page')}&limit=100`;
    console.log(`Fetching Confluence pages via: ${url}`);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    console.log("Confluence Pages Response:", JSON.stringify(response.data.results?.[0] || response.data, null, 2));

    const results = response.data.results || [];
    // Extract actual content from search payload
    return results.map(item => {
      // The search endpoint nests the page info in .content, but fallback to item
      const content = item.content || item;
      return {
        id: content.id || item.id,
        title: content.title || item.title || "Untitled Document",
        type: content.type || "page"
      };
    }).filter(p => p.id);
  } catch (err) {
    if (err.response?.status === 401) throw new Error("401");
    console.error("Failed to fetch Confluence Pages. Status Code:", err.response?.status, "Data:", JSON.stringify(err.response?.data));
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
    // console.log("ISSUES : ", JSON.stringify(uniqueIssues, null, 2))
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

export async function fetchConfluencePageContent(accessToken, cloudId, pageId) {
  try {
    // Using search with CQL id=... is often more robust than direct /content/{id} which can return 410 Gone
    const url = `https://api.atlassian.com/ex/confluence/${cloudId}/rest/api/search?cql=id="${pageId}"&expand=content.body.storage`;
    console.log(`Fetching Confluence Page Content via search/CQL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    
    const results = response.data.results || [];
    if (results.length > 0) {
      const content = results[0].content || results[0];
      return content;
    }
    return null;
  } catch (err) {
    console.error(`Failed to fetch Confluence Page Content for ${pageId}: Status ${err.response?.status} - ${err.message}`);
    return null;
  }
}
