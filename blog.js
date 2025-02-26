document.addEventListener("DOMContentLoaded", () => {
    const blogIndex = document.getElementById("blog_index");
    const tableOfContents = document.getElementById("table_of_contents");
    const tocItemList = tableOfContents.querySelector("ul");
    const blogRoot = "blog_posts/";
    
    const blogPosts = [
        { 
            path: "heavy-processing-api-gw-ddb-part1.html", 
            title: "Part 1 - High Throughput Processing and Persistence from API Gateway to DynamoDB", 
            date: "2025-02-25", 
            summary: `Recently, we faced the challenge of processing and persisting around 800K"  
                      records coming in from roughly 40 API Gateway requests over a short period of time.
                      The following summary outlines the iterative approach we used to solve this problem`
        },
        { 
            path: "heavy-processing-api-gw-ddb-part2.html", 
            title: "Part 2 - High Throughput Processing and Persistence from API Gateway to DynamoDB", 
            date: "2025-02-25", 
            summary: `in Part 1 we went from 3,400 records using the design: API Gateway -> Lambda -> DybnamoDB`
        }
    ];
    
    blogPosts.forEach((post, index) => {
        const postUrl = `${blogRoot}${post.path}`;
        const blogSummary = document.createElement("div");

        const summaryId = `${index}_${post.path.slice(0, 3)}`;
        blogSummary.id = summaryId;
        blogSummary.classList.add("blog_summary");
        blogSummary.innerHTML = `
            <h1><a href="${postUrl}">${post.title}</a></h1>
            <h3 class="last-modified-date">Last Modified: ${post.date}</h3>
            <p>${post.summary}...</p>
        `;
        blogIndex.appendChild(blogSummary);
    
        // Create table of contents entry
        const tocEntry = document.createElement("li");
        tocEntry.innerHTML = `<a href="#${summaryId}">${post.title}</a>`;
        tocItemList.appendChild(tocEntry);
    });
});